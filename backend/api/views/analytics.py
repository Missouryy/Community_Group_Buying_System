from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count, Sum, Avg, Q
from django.utils import timezone
from datetime import datetime, timedelta
from api.models import Order, GroupBuy, User, Product
from api.permissions import IsAdminRole


class UserBehaviorTrackingView(APIView):
    """用户行为跟踪"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        """记录用户行为"""
        try:
            action = request.data.get('action')
            page = request.data.get('page', '')
            target_id = request.data.get('target_id')
            extra_data = request.data.get('extra_data', {})
            
            # 在实际应用中，可以将用户行为存储到专门的分析数据库
            # 这里简化处理，只返回成功响应
            
            # 可以记录的行为类型：
            # - page_view: 页面访问
            # - product_view: 商品查看
            # - groupbuy_view: 拼单详情查看
            # - join_groupbuy: 参加拼单
            # - share_groupbuy: 分享拼单
            # - search: 搜索行为
            # - filter: 筛选行为
            
            return Response({
                'success': True,
                'message': '行为记录成功'
            })
            
        except Exception as e:
            return Response({'error': str(e)}, status=500)


class AdminAnalyticsView(APIView):
    """管理员数据分析"""
    permission_classes = [IsAuthenticated, IsAdminRole]
    
    def get(self, request):
        """获取分析数据"""
        try:
            analysis_type = request.GET.get('type', 'overview')
            days = int(request.GET.get('days', 30))
            
            start_date = timezone.now() - timedelta(days=days)
            
            if analysis_type == 'overview':
                return self.get_overview_analytics(start_date)
            elif analysis_type == 'user_behavior':
                return self.get_user_behavior_analytics(start_date)
            elif analysis_type == 'product_performance':
                return self.get_product_performance_analytics(start_date)
            elif analysis_type == 'leader_performance':
                return self.get_leader_performance_analytics(start_date)
            else:
                return Response({'error': '无效的分析类型'}, status=400)
                
        except Exception as e:
            return Response({'error': str(e)}, status=500)
    
    def get_overview_analytics(self, start_date):
        """获取概览分析数据"""
        # 用户统计
        total_users = User.objects.count()
        new_users = User.objects.filter(date_joined__gte=start_date).count()
        active_users = User.objects.filter(
            order_set__created_at__gte=start_date
        ).distinct().count()
        
        # 拼单统计
        total_groupbuys = GroupBuy.objects.filter(created_at__gte=start_date).count()
        successful_groupbuys = GroupBuy.objects.filter(
            created_at__gte=start_date,
            status='successful'
        ).count()
        success_rate = (successful_groupbuys / total_groupbuys * 100) if total_groupbuys > 0 else 0
        
        # 订单统计
        total_orders = Order.objects.filter(created_at__gte=start_date).count()
        paid_orders = Order.objects.filter(
            created_at__gte=start_date,
            payment_status='paid'
        ).count()
        
        # 收入统计
        total_revenue = Order.objects.filter(
            created_at__gte=start_date,
            payment_status='paid'
        ).aggregate(total=Sum('total_price'))['total'] or 0
        
        # 平均订单价值
        avg_order_value = Order.objects.filter(
            created_at__gte=start_date,
            payment_status='paid'
        ).aggregate(avg=Avg('total_price'))['avg'] or 0
        
        return Response({
            'user_stats': {
                'total_users': total_users,
                'new_users': new_users,
                'active_users': active_users,
                'retention_rate': (active_users / new_users * 100) if new_users > 0 else 0
            },
            'groupbuy_stats': {
                'total_groupbuys': total_groupbuys,
                'successful_groupbuys': successful_groupbuys,
                'success_rate': round(success_rate, 2)
            },
            'order_stats': {
                'total_orders': total_orders,
                'paid_orders': paid_orders,
                'conversion_rate': (paid_orders / total_orders * 100) if total_orders > 0 else 0
            },
            'revenue_stats': {
                'total_revenue': float(total_revenue),
                'avg_order_value': float(avg_order_value)
            }
        })
    
    def get_user_behavior_analytics(self, start_date):
        """获取用户行为分析"""
        # 最活跃用户
        most_active_users = User.objects.filter(
            order_set__created_at__gte=start_date
        ).annotate(
            order_count=Count('order_set')
        ).order_by('-order_count')[:10]
        
        # 用户参团行为分析
        user_join_patterns = Order.objects.filter(
            created_at__gte=start_date
        ).values('user__id').annotate(
            total_orders=Count('id'),
            total_spent=Sum('total_price')
        )
        
        # 用户留存分析（简化版）
        retention_data = []
        for i in range(7):  # 分析7天的留存
            date = start_date + timedelta(days=i)
            new_users_on_date = User.objects.filter(
                date_joined__date=date.date()
            ).count()
            
            # 这些用户在后续几天的活跃情况
            active_next_day = User.objects.filter(
                date_joined__date=date.date(),
                order_set__created_at__date=date.date() + timedelta(days=1)
            ).distinct().count()
            
            retention_rate = (active_next_day / new_users_on_date * 100) if new_users_on_date > 0 else 0
            
            retention_data.append({
                'date': date.date().isoformat(),
                'new_users': new_users_on_date,
                'retention_rate': round(retention_rate, 2)
            })
        
        return Response({
            'most_active_users': [
                {
                    'user_id': user.id,
                    'username': user.username,
                    'order_count': user.order_count
                }
                for user in most_active_users
            ],
            'retention_data': retention_data
        })
    
    def get_product_performance_analytics(self, start_date):
        """获取商品表现分析"""
        # 最受欢迎的商品
        popular_products = Product.objects.filter(
            groupbuy_set__order_set__created_at__gte=start_date
        ).annotate(
            order_count=Count('groupbuy_set__order_set'),
            total_sales=Sum('groupbuy_set__order_set__total_price')
        ).order_by('-order_count')[:10]
        
        # 商品类别分析
        category_performance = Product.objects.filter(
            groupbuy_set__order_set__created_at__gte=start_date
        ).values('category').annotate(
            product_count=Count('id'),
            order_count=Count('groupbuy_set__order_set'),
            total_sales=Sum('groupbuy_set__order_set__total_price')
        ).order_by('-total_sales')
        
        return Response({
            'popular_products': [
                {
                    'product_id': product.id,
                    'name': product.name,
                    'order_count': product.order_count,
                    'total_sales': float(product.total_sales or 0)
                }
                for product in popular_products
            ],
            'category_performance': list(category_performance)
        })
    
    def get_leader_performance_analytics(self, start_date):
        """获取团长表现分析"""
        # 最佳团长
        top_leaders = User.objects.filter(
            role='leader',
            groupbuy_set__created_at__gte=start_date
        ).annotate(
            groupbuy_count=Count('groupbuy_set'),
            successful_count=Count(
                'groupbuy_set',
                filter=Q(groupbuy_set__status='successful')
            ),
            total_orders=Count('groupbuy_set__order_set'),
            total_revenue=Sum('groupbuy_set__order_set__total_price')
        ).order_by('-total_revenue')[:10]
        
        # 团长成功率分析
        leader_success_rates = []
        for leader in top_leaders:
            success_rate = (leader.successful_count / leader.groupbuy_count * 100) if leader.groupbuy_count > 0 else 0
            leader_success_rates.append({
                'leader_id': leader.id,
                'name': leader.real_name or leader.username,
                'groupbuy_count': leader.groupbuy_count,
                'success_rate': round(success_rate, 2),
                'total_revenue': float(leader.total_revenue or 0)
            })
        
        return Response({
            'top_leaders': leader_success_rates
        })


class DailyStatsView(APIView):
    """每日统计数据"""
    permission_classes = [IsAuthenticated, IsAdminRole]
    
    def get(self, request):
        """获取每日统计"""
        try:
            days = int(request.GET.get('days', 7))
            
            daily_stats = []
            for i in range(days):
                date = timezone.now().date() - timedelta(days=i)
                
                # 当日新用户
                new_users = User.objects.filter(date_joined__date=date).count()
                
                # 当日新拼单
                new_groupbuys = GroupBuy.objects.filter(created_at__date=date).count()
                
                # 当日订单
                daily_orders = Order.objects.filter(created_at__date=date)
                order_count = daily_orders.count()
                
                # 当日收入
                daily_revenue = daily_orders.filter(
                    payment_status='paid'
                ).aggregate(total=Sum('total_price'))['total'] or 0
                
                daily_stats.append({
                    'date': date.isoformat(),
                    'new_users': new_users,
                    'new_groupbuys': new_groupbuys,
                    'order_count': order_count,
                    'revenue': float(daily_revenue)
                })
            
            return Response({
                'daily_stats': list(reversed(daily_stats))  # 按时间正序
            })
            
        except Exception as e:
            return Response({'error': str(e)}, status=500)
