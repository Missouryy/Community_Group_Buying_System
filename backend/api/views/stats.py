from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Count, Sum, F, Q
from django.utils import timezone
from datetime import datetime, timedelta
from decimal import Decimal
from api.models import GroupBuy, Order, User, Product


class PublicStatsView(APIView):
    """公开统计数据 - 用于首页显示"""
    
    def get(self, request):
        try:
            # 活跃拼单数
            active_groups = GroupBuy.objects.filter(
                status='active',
                end_time__gt=timezone.now()
            ).count()
            
            # 总参团人数（估算）
            total_participants = Order.objects.filter(
                status__in=['awaiting_group_success', 'successful', 'completed']
            ).aggregate(total=Sum('quantity'))['total'] or 0
            
            # 总节省金额（估算）
            total_savings = Decimal('0')
            products = Product.objects.all()
            price_multiplier = Decimal('1.2')
            for product in products:
                # 假设原价比拼单价高20%
                original_price = product.price * price_multiplier
                savings_per_item = original_price - product.price
                orders_count = Order.objects.filter(
                    group_buy__product=product,
                    status__in=['successful', 'completed']
                ).aggregate(total=Sum('quantity'))['total'] or 0
                total_savings += savings_per_item * orders_count
                
            return Response({
                'active_groups': active_groups,
                'total_participants': total_participants,
                'total_savings': f"{total_savings:.0f}"
            })
        except Exception as e:
            return Response({
                'active_groups': 0,
                'total_participants': 0,
                'total_savings': '0'
            })


class SuccessfulGroupBuysView(APIView):
    """成功的拼单案例"""
    
    def get(self, request):
        limit = int(request.GET.get('limit', 6))
        
        try:
            # 查询成功的拼单
            successful_groupbuys = GroupBuy.objects.filter(
                status='successful'
            ).select_related('product', 'leader').order_by('-updated_at')[:limit]
            
            results = []
            for gb in successful_groupbuys:
                # 计算最终参团人数
                final_participants = Order.objects.filter(
                    group_buy=gb,
                    status__in=['successful', 'completed']
                ).aggregate(total=Sum('quantity'))['total'] or 0
                
                # 计算总节省金额
                if gb.product:
                    price_multiplier = Decimal('1.2')
                    original_price = gb.product.price * price_multiplier
                    savings_per_item = original_price - gb.product.price
                    total_savings = savings_per_item * final_participants
                else:
                    total_savings = Decimal('0')
                
                results.append({
                    'id': gb.id,
                    'product_name': gb.product.name if gb.product else '未知商品',
                    'final_participants': final_participants,
                    'total_savings': f"{total_savings:.0f}",
                    'completed_at': gb.updated_at.isoformat()
                })
            
            return Response(results)
        except Exception as e:
            return Response([])


class FeaturedLeadersView(APIView):
    """优秀团长推荐"""
    
    def get(self, request):
        limit = int(request.GET.get('limit', 3))
        
        try:
            # 查找成功拼单数最多的团长（注意：GroupBuy 的成功状态是 'successful'）
            featured_leaders = User.objects.filter(
                role='leader',
                is_active=True
            ).annotate(
                successful_groupbuys=Count(
                    'led_groupbuys',
                    filter=Q(led_groupbuys__status='successful')
                )
            ).order_by('-successful_groupbuys')[:limit]
            
            results = []
            for leader in featured_leaders:
                results.append({
                    'id': leader.id,
                    'name': leader.real_name or leader.username,
                    'successful_groupbuys': leader.successful_groupbuys
                })
            
            return Response(results)
        except Exception as e:
            return Response([])


class RecommendationsView(APIView):
    """个性化商品推荐"""
    
    def get(self, request):
        try:
            # 如果用户已登录，基于购买历史推荐
            if request.user.is_authenticated:
                # 获取用户购买过的商品类别
                user_categories = Order.objects.filter(
                    user=request.user,
                    status__in=['successful', 'completed']
                ).values_list('group_buy__product__category', flat=True).distinct()
                
                # 推荐同类别的其他商品
                if user_categories:
                    recommended_products = Product.objects.filter(
                        category__in=user_categories,
                        stock_quantity__gt=0
                    ).exclude(
                        id__in=Order.objects.filter(
                            user=request.user
                        ).values_list('group_buy__product_id', flat=True)
                    )[:6]
                else:
                    # 新用户推荐热门商品
                    recommended_products = Product.objects.filter(
                        stock_quantity__gt=0
                    ).annotate(
                        order_count=Count('groupbuy_set__order_set')
                    ).order_by('-order_count')[:6]
            else:
                # 未登录用户推荐热门商品
                recommended_products = Product.objects.filter(
                    stock_quantity__gt=0
                ).annotate(
                    order_count=Count('groupbuy_set__order_set')
                ).order_by('-order_count')[:6]
            
            results = []
            price_multiplier = Decimal('1.2')
            for product in recommended_products:
                image_url = None
                if product.image:
                    image_url = request.build_absolute_uri(product.image.url)
                    
                results.append({
                    'id': product.id,
                    'name': product.name,
                    'price': str(product.price),
                    'original_price': str(product.price * price_multiplier),  # 估算原价
                    'image': image_url,
                    'stock_quantity': product.stock_quantity,
                    'category': product.category.name if product.category else None
                })
            
            return Response(results)
        except Exception as e:
            # 降级处理：返回所有商品
            products = Product.objects.filter(stock_quantity__gt=0)[:6]
            results = []
            for product in products:
                image_url = None
                if product.image:
                    image_url = request.build_absolute_uri(product.image.url)
                    
                results.append({
                    'id': product.id,
                    'name': product.name,
                    'price': str(product.price),
                    'image': image_url,
                    'stock_quantity': product.stock_quantity
                })
            return Response(results)
