from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from .models import Product, User, Alert, Order, GroupBuy
from .serializers import ProductSerializer, AlertSerializer
from .permissions import IsAdminRole
from rest_framework.parsers import MultiPartParser, FormParser
from django.db.models import Sum, Count, F
from django.utils import timezone
from datetime import timedelta
from django.db.models.functions import TruncDate


class AdminProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all().order_by('-id')
    serializer_class = ProductSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]
    parser_classes = [MultiPartParser, FormParser]


class LeaderApplicationsListView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def get(self, request):
        qs = User.objects.filter(leader_status='pending').order_by('-date_joined')
        data = [
            {
                'id': u.id,
                'username': u.username,
                'email': u.email,
                'real_name': u.real_name,
                'leader_status': u.leader_status,
                'date_joined': u.date_joined,
            }
            for u in qs
        ]
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

