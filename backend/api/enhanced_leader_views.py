from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count, Sum, Q
from django.utils import timezone
from datetime import datetime, timedelta
from .models import GroupBuy, Order, User, Product
from .permissions import IsLeaderRole


class LeaderStatsView(APIView):
    """团长统计数据"""
    permission_classes = [IsAuthenticated, IsLeaderRole]
    
    def get(self, request):
        try:
            leader = request.user
            current_month = timezone.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            
            # 我的拼单数
            my_groupbuys = GroupBuy.objects.filter(leader=leader).count()
            
            # 待提货订单数
            pending_pickups = Order.objects.filter(
                group_buy__leader=leader,
                status='successful'
            ).count()
            
            # 本月提成（估算）
            monthly_orders = Order.objects.filter(
                group_buy__leader=leader,
                status__in=['successful', 'completed'],
                created_at__gte=current_month
            )
            monthly_commission = 0
            for order in monthly_orders:
                # 假设提成比例为10%
                commission = order.total_price * 0.1
                monthly_commission += commission
            
            # 总收益（估算）
            all_orders = Order.objects.filter(
                group_buy__leader=leader,
                status__in=['successful', 'completed']
            )
            total_earnings = 0
            for order in all_orders:
                commission = order.total_price * 0.1
                total_earnings += commission
            
            return Response({
                'my_groupbuys': my_groupbuys,
                'pending_pickups': pending_pickups,
                'monthly_commission': f"{monthly_commission:.2f}",
                'total_earnings': f"{total_earnings:.2f}"
            })
        except Exception as e:
            return Response({
                'my_groupbuys': 0,
                'pending_pickups': 0,
                'monthly_commission': '0.00',
                'total_earnings': '0.00'
            })


class LeaderPickupsView(APIView):
    """团长提货管理"""
    permission_classes = [IsAuthenticated, IsLeaderRole]
    
    def get(self, request):
        try:
            leader = request.user
            
            # 获取需要提货的订单
            pickup_orders = Order.objects.filter(
                group_buy__leader=leader,
                status__in=['successful', 'ready_for_pickup', 'picked_up']
            ).select_related('user', 'group_buy__product').order_by('-created_at')
            
            results = []
            for order in pickup_orders:
                results.append({
                    'order_id': order.id,
                    'user_name': order.user.real_name or order.user.username,
                    'user_phone': getattr(order.user, 'phone', ''),
                    'user_id': order.user.id,
                    'product_name': order.group_buy.product.name if order.group_buy.product else '未知商品',
                    'quantity': order.quantity,
                    'total_price': str(order.total_price),
                    'status': order.status,
                    'pickup_address': getattr(order, 'pickup_address', ''),
                    'pickup_time': order.updated_at.isoformat() if order.status == 'picked_up' else None
                })
            
            return Response(results)
        except Exception as e:
            return Response([])


class LeaderCommissionsSummaryView(APIView):
    """团长提成汇总"""
    permission_classes = [IsAuthenticated, IsLeaderRole]
    
    def get(self, request):
        try:
            leader = request.user
            current_month = timezone.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            
            # 总收益
            all_orders = Order.objects.filter(
                group_buy__leader=leader,
                status__in=['successful', 'completed']
            )
            total_earnings = sum(order.total_price * 0.1 for order in all_orders)
            
            # 本月收益
            monthly_orders = all_orders.filter(created_at__gte=current_month)
            monthly_earnings = sum(order.total_price * 0.1 for order in monthly_orders)
            
            # 待结算收益（已完成但未结算的订单）
            pending_orders = Order.objects.filter(
                group_buy__leader=leader,
                status='completed'
                # 这里可以添加结算状态字段的过滤
            )
            pending_earnings = sum(order.total_price * 0.1 for order in pending_orders)
            
            return Response({
                'total_earnings': f"{total_earnings:.2f}",
                'monthly_earnings': f"{monthly_earnings:.2f}",
                'pending_earnings': f"{pending_earnings:.2f}",
                'commission_rate': 10  # 10%提成比例
            })
        except Exception as e:
            return Response({
                'total_earnings': '0.00',
                'monthly_earnings': '0.00',
                'pending_earnings': '0.00',
                'commission_rate': 10
            })


class LeaderCommissionsView(APIView):
    """团长提成明细"""
    permission_classes = [IsAuthenticated, IsLeaderRole]
    
    def get(self, request):
        try:
            leader = request.user
            
            orders = Order.objects.filter(
                group_buy__leader=leader,
                status__in=['successful', 'completed']
            ).select_related('group_buy__product').order_by('-created_at')
            
            results = []
            for order in orders:
                commission_amount = order.total_price * 0.1
                results.append({
                    'id': order.id,
                    'created_at': order.created_at.isoformat(),
                    'groupbuy_id': order.group_buy.id,
                    'groupbuy_name': f"拼单 #{order.group_buy.id}",
                    'product_name': order.group_buy.product.name if order.group_buy.product else '未知商品',
                    'order_amount': str(order.total_price),
                    'commission_amount': f"{commission_amount:.2f}",
                    'status': 'settled' if order.status == 'completed' else 'pending'
                })
            
            return Response(results)
        except Exception as e:
            return Response([])
