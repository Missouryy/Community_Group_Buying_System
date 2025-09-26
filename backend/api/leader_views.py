from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db import transaction
from django.db.models import Prefetch
from .models import GroupBuy, Order, OrderItem, Product
from .serializers import GroupBuySerializer, OrderSerializer
from .permissions import IsLeaderRole


class LeaderGroupBuyListCreateView(generics.ListCreateAPIView):
    serializer_class = GroupBuySerializer
    permission_classes = [permissions.IsAuthenticated, IsLeaderRole]

    def get_queryset(self):
        return GroupBuy.objects.filter(leader=self.request.user).order_by('-id')

    def perform_create(self, serializer):
        serializer.save(leader=self.request.user)


class LeaderGroupBuyOrdersView(generics.ListAPIView):
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated, IsLeaderRole]

    def get_queryset(self):
        group_buy_id = self.kwargs.get('id')
        return (
            Order.objects
            .filter(group_buy__leader=self.request.user, group_buy_id=group_buy_id)
            .prefetch_related('items', 'items__product', 'group_buy')
            .order_by('-id')
        )


class LeaderConfirmPickupView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsLeaderRole]

    def post(self, request, id: int):
        try:
            order = Order.objects.select_related('group_buy').get(id=id, group_buy__leader=request.user)
        except Order.DoesNotExist:
            return Response({'error': '订单不存在'}, status=status.HTTP_404_NOT_FOUND)

        if order.status != 'successful':
            return Response({'error': '订单状态不是“已成团”，无法确认提货'}, status=status.HTTP_400_BAD_REQUEST)

        order.status = 'ready_for_pickup'
        order.save()
        return Response({'ok': True})

