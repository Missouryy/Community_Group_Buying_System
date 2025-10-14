from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from .models import Product, User, Alert, Order, GroupBuy, OrderItem
from .serializers import ProductSerializer, AlertSerializer, OrderSerializer, OrderDetailSerializer
from .permissions import IsAdminRole
from rest_framework.parsers import MultiPartParser, FormParser
from django.db.models import Sum, Count, F, Q
from django.utils import timezone
from datetime import timedelta
from django.db.models.functions import TruncDate
from django.db import transaction


class AdminProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all().order_by('-id')
    serializer_class = ProductSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]
    parser_classes = [MultiPartParser, FormParser]


class LeaderApplicationsListView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def get(self, request):
        from decimal import Decimal
        
        # 获取所有团长相关用户：待审核、已批准、已拒绝
        status_filter = request.GET.get('status', 'all')
        
        if status_filter == 'pending':
            qs = User.objects.filter(leader_status='pending')
        elif status_filter == 'approved':
            qs = User.objects.filter(role='leader', leader_status='approved')
        elif status_filter == 'rejected':
            qs = User.objects.filter(leader_status='rejected')
        else:
            # 返回所有与团长相关的用户
            qs = User.objects.filter(
                Q(leader_status__isnull=False) | Q(role='leader')
            )
        
        qs = qs.order_by('-date_joined')
        
        # 计算统计信息
        data = []
        commission_rate = Decimal('0.1')
        current_month = timezone.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        for u in qs:
            user_data = {
                'id': u.id,
                'username': u.username,
                'email': u.email,
                'real_name': u.real_name,
                'phone': u.phone,
                'address': u.address,
                'role': u.role,
                'leader_status': u.leader_status,
                'is_active': u.is_active,
                'application_reason': u.application_reason,
                'rejection_reason': u.rejection_reason,
                'date_joined': u.date_joined.isoformat() if u.date_joined else None,
                'created_at': u.date_joined.isoformat() if u.date_joined else None,
            }
            
            # 如果是已批准的团长，添加统计信息
            if u.role == 'leader':
                # 拼单数
                groupbuy_count = GroupBuy.objects.filter(leader=u).count()
                
                # 本月收益
                monthly_orders = Order.objects.filter(
                    group_buy__leader=u,
                    status__in=['successful', 'completed'],
                    created_at__gte=current_month
                )
                monthly_commission = sum((order.total_price * commission_rate) for order in monthly_orders) if monthly_orders.exists() else Decimal('0')
                
                user_data['groupbuy_count'] = groupbuy_count
                user_data['monthly_commission'] = f"{monthly_commission:.2f}"
            else:
                user_data['groupbuy_count'] = 0
                user_data['monthly_commission'] = '0.00'
            
            data.append(user_data)
        
        return Response(data)


class LeaderApplicationDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def patch(self, request, user_id: int):
        status_value = request.data.get('status')
        if status_value not in ('approved', 'rejected'):
            return Response({'error': 'status 只能是 approved 或 rejected'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            u = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'error': '用户不存在'}, status=status.HTTP_404_NOT_FOUND)

        if status_value == 'approved':
            u.role = 'leader'
            u.leader_status = 'approved'
        else:
            # 拒绝时保持 role 为 user，并标记为 rejected
            if u.role == 'leader':
                u.role = 'user'
            u.leader_status = 'rejected'
        u.save()
        return Response({'ok': True})


class AdminAlertListView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def get(self, request):
        alerts = Alert.objects.select_related('product').order_by('-id')
        data = AlertSerializer(alerts, many=True).data
        return Response(data)


class AdminAlertMarkReadView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def post(self, request, alert_id: int):
        try:
            alert = Alert.objects.get(id=alert_id)
        except Alert.DoesNotExist:
            return Response({'error': '预警不存在'}, status=status.HTTP_404_NOT_FOUND)
        alert.is_read = True
        alert.save()
        return Response({'ok': True})


class AdminStatsView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def get(self, request):
        valid_statuses = ['successful', 'ready_for_pickup', 'completed']
        agg = Order.objects.filter(status__in=valid_statuses).aggregate(
            total_sales=Sum('total_price'),
            total_orders=Count('id')
        )
        completed_orders = Order.objects.filter(status='completed').count()
        active_groupbuys = GroupBuy.objects.filter(status='active').count()
        pending_leaders = User.objects.filter(leader_status='pending').count()
        low_stock_count = Product.objects.filter(stock_quantity__lt=F('warning_threshold')).count()
        return Response({
            'total_sales': str(agg.get('total_sales') or 0),
            'total_orders': agg.get('total_orders') or 0,
            'completed_orders': completed_orders,
            'active_groupbuys': active_groupbuys,
            'pending_leaders': pending_leaders,
            'low_stock_count': low_stock_count,
        })


class AdminSalesDailyView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def get(self, request):
        days = int(request.GET.get('days', 7))
        days = max(1, min(days, 90))
        since = timezone.now() - timedelta(days=days)
        valid_statuses = ['successful', 'ready_for_pickup', 'completed']
        qs = (
            Order.objects
            .filter(created_at__gte=since, status__in=valid_statuses)
            .annotate(day=TruncDate('created_at'))
            .values('day')
            .annotate(total=Sum('total_price'), count=Count('id'))
            .order_by('day')
        )
        data = [
            {
                'day': str(r['day']),
                'total': str(r['total'] or 0),
                'count': r['count'],
            }
            for r in qs
        ]
        return Response({'days': days, 'items': data})


class AdminOrderListView(APIView):
    """管理员订单列表"""
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def get(self, request):
        # 获取查询参数
        status_filter = request.GET.get('status')
        search = request.GET.get('search')
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 20))
        
        # 构建查询
        queryset = Order.objects.select_related(
            'user', 'group_buy', 'group_buy__product', 'group_buy__leader'
        ).prefetch_related('items').order_by('-created_at')
        
        # 状态筛选
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        # 搜索
        if search:
            queryset = queryset.filter(
                Q(user__username__icontains=search) |
                Q(user__real_name__icontains=search) |
                Q(group_buy__product__name__icontains=search) |
                Q(id__icontains=search)
            )
        
        # 分页
        total = queryset.count()
        start = (page - 1) * page_size
        end = start + page_size
        orders = queryset[start:end]
        
        # 序列化数据
        data = []
        try:
            for order in orders:
                # 安全获取 quantity（Order 模型可能有也可能没有这个字段）
                quantity = getattr(order, 'quantity', None)
                if quantity is None:
                    # 如果 Order 没有 quantity，从 OrderItem 中计算
                    quantity = sum(item.quantity for item in order.items.all())
                
                data.append({
                    'id': order.id,
                    'user_id': order.user.id,
                    'user_name': order.user.real_name or order.user.username,
                    'user_phone': order.user.phone or '',
                    'product_name': order.group_buy.product.name if order.group_buy and order.group_buy.product else '未知商品',
                    'leader_name': order.group_buy.leader.real_name or order.group_buy.leader.username if order.group_buy and order.group_buy.leader else '未知团长',
                    'quantity': quantity or 1,
                    'total_price': str(order.total_price),
                    'status': order.status,
                    'payment_status': order.payment_status,
                    'payment_method': order.payment_method or '',
                    'created_at': order.created_at.isoformat(),
                    'updated_at': order.updated_at.isoformat(),
                })
        except Exception as e:
            # 如果出错，返回错误信息
            return Response({
                'error': f'序列化订单数据失败: {str(e)}',
                'total': 0,
                'page': page,
                'page_size': page_size,
                'results': []
            }, status=500)
        
        return Response({
            'total': total,
            'page': page,
            'page_size': page_size,
            'results': data
        })


class AdminOrderDetailView(APIView):
    """管理员订单详情"""
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def get(self, request, order_id):
        try:
            order = Order.objects.select_related(
                'user', 'group_buy', 'group_buy__product', 'group_buy__leader'
            ).prefetch_related('items', 'items__product').get(id=order_id)
            
            # 订单项
            items_data = []
            for item in order.items.all():
                items_data.append({
                    'id': item.id,
                    'product_id': item.product.id,
                    'product_name': item.product.name,
                    'quantity': item.quantity,
                    'price_per_unit': str(item.price_per_unit),
                    'subtotal': str(item.price_per_unit * item.quantity)
                })
            
            data = {
                'id': order.id,
                'user': {
                    'id': order.user.id,
                    'username': order.user.username,
                    'real_name': order.user.real_name,
                    'phone': order.user.phone,
                    'email': order.user.email,
                },
                'group_buy': {
                    'id': order.group_buy.id,
                    'product_name': order.group_buy.product.name if order.group_buy.product else '未知商品',
                    'leader_name': order.group_buy.leader.real_name or order.group_buy.leader.username,
                    'status': order.group_buy.status,
                },
                'quantity': order.quantity,
                'total_price': str(order.total_price),
                'status': order.status,
                'payment_status': order.payment_status,
                'payment_method': order.payment_method,
                'payment_time': order.payment_time.isoformat() if order.payment_time else None,
                'pickup_address': order.pickup_address,
                'items': items_data,
                'created_at': order.created_at.isoformat(),
                'updated_at': order.updated_at.isoformat(),
            }
            
            return Response(data)
        except Order.DoesNotExist:
            return Response({'error': '订单不存在'}, status=404)


class AdminOrderUpdateStatusView(APIView):
    """管理员更新订单状态"""
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def post(self, request, order_id):
        try:
            order = Order.objects.get(id=order_id)
            new_status = request.data.get('status')
            
            # 验证状态
            valid_statuses = dict(Order.STATUS_CHOICES).keys()
            if new_status not in valid_statuses:
                return Response({'error': '无效的订单状态'}, status=400)
            
            order.status = new_status
            order.save()
            
            return Response({
                'success': True,
                'message': '订单状态已更新',
                'order_id': order.id,
                'new_status': new_status
            })
        except Order.DoesNotExist:
            return Response({'error': '订单不存在'}, status=404)


class AdminOrderBatchUpdateView(APIView):
    """管理员批量更新订单"""
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def post(self, request):
        order_ids = request.data.get('order_ids', [])
        new_status = request.data.get('status')
        
        if not order_ids:
            return Response({'error': '请选择订单'}, status=400)
        
        # 验证状态
        valid_statuses = dict(Order.STATUS_CHOICES).keys()
        if new_status not in valid_statuses:
            return Response({'error': '无效的订单状态'}, status=400)
        
        updated_count = Order.objects.filter(id__in=order_ids).update(status=new_status)
        
        return Response({
            'success': True,
            'message': f'已更新 {updated_count} 个订单',
            'updated_count': updated_count
        })


class AdminOrderCancelView(APIView):
    """管理员取消订单"""
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def post(self, request, order_id):
        try:
            with transaction.atomic():
                order = Order.objects.select_related('group_buy').get(id=order_id)
                
                if order.status in ['completed', 'canceled']:
                    return Response({'error': '该订单无法取消'}, status=400)
                
                # 取消订单
                order.status = 'canceled'
                order.save()
                
                # 更新拼单参与人数
                if order.group_buy.current_participants > 0:
                    order.group_buy.current_participants -= 1
                    order.group_buy.save()
                
                return Response({
                    'success': True,
                    'message': '订单已取消'
                })
        except Order.DoesNotExist:
            return Response({'error': '订单不存在'}, status=404)

