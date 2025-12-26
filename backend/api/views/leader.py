from rest_framework import generics, permissions, status, serializers
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db import transaction
from django.db.models import Prefetch
from django.utils import timezone
from api.models import GroupBuy, Order, OrderItem, Product, MembershipTier
from api.serializers import GroupBuySerializer, OrderSerializer
from api.permissions import IsLeaderRole


class LeaderGroupBuyListCreateView(generics.ListCreateAPIView):
    serializer_class = GroupBuySerializer
    permission_classes = [permissions.IsAuthenticated, IsLeaderRole]

    def get_queryset(self):
        return GroupBuy.objects.filter(leader=self.request.user).order_by('-id')

    def perform_create(self, serializer):
        # 权限已在 IsLeaderRole 中检查，这里进行额外验证
        
        # 验证商品是否存在且有足够库存
        product = serializer.validated_data.get('product')
        if not product:
            raise serializers.ValidationError({'error': '商品不存在'})
        
        target_participants = serializer.validated_data.get('target_participants')
        if product.stock_quantity < target_participants:
            raise serializers.ValidationError({'error': f'商品库存不足。当前库存：{product.stock_quantity}，目标人数：{target_participants}'})
        
        # 验证时间
        start_time = serializer.validated_data.get('start_time')
        end_time = serializer.validated_data.get('end_time')
        now = timezone.now()
        
        if start_time < now:
            raise serializers.ValidationError({'error': '开始时间不能早于当前时间'})
        
        if end_time <= start_time:
            raise serializers.ValidationError({'error': '结束时间必须晚于开始时间'})
        
        # 自动设置状态为active（如果开始时间是现在）或pending（如果开始时间在未来）
        if start_time <= now:
            serializer.validated_data['status'] = 'active'
        else:
            serializer.validated_data['status'] = 'pending'
        
        serializer.save(leader=self.request.user)
    
    def create(self, request, *args, **kwargs):
        try:
            return super().create(request, *args, **kwargs)
        except serializers.ValidationError as e:
            return Response(e.detail, status=status.HTTP_400_BAD_REQUEST)


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

        if order.status not in ['successful', 'ready_for_pickup', 'pending_payment']:
            return Response({'error': '订单状态不正确，无法确认提货'}, status=status.HTTP_400_BAD_REQUEST)

        # 只有successful或ready_for_pickup状态才需要更新
        if order.status in ['successful', 'ready_for_pickup']:
            if getattr(order, 'payment_status', '') == 'paid':
                # 如果已支付，直接完成订单并结算积分
                order.status = 'completed'
                order.save()
                
                # 增加积分并升级会员
                user = order.user
                user.loyalty_points = (user.loyalty_points or 0) + int(order.total_price)
                
                # 自动匹配最高可达会员等级
                candidates = MembershipTier.objects.all().order_by('points_required')
                new_tier = None
                for t in candidates:
                    if user.loyalty_points >= t.points_required:
                        new_tier = t
                if new_tier:
                    user.membership_tier = new_tier
                user.save()
            else:
                # 未支付则转为待支付
                order.status = 'pending_payment'
                order.save()
        
        return Response({'ok': True})


class LeaderStartGroupBuyView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsLeaderRole]

    def post(self, request, id: int):
        try:
            gb = GroupBuy.objects.get(id=id, leader=request.user)
        except GroupBuy.DoesNotExist:
            return Response({'error': '拼单不存在'}, status=status.HTTP_404_NOT_FOUND)

        if gb.status not in ('pending',):
            return Response({'error': '仅待开始的拼单可手动开始'}, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()
        if gb.end_time <= now:
            return Response({'error': '结束时间已到，无法开始'}, status=status.HTTP_400_BAD_REQUEST)

        gb.status = 'active'
        # 若开始时间在未来，调整为现在
        if gb.start_time > now:
            gb.start_time = now
        gb.save()
        return Response({'ok': True})

