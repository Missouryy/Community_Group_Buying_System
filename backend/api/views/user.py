from django.db import transaction
from django.utils import timezone
from rest_framework import status, permissions, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from api.models import GroupBuy, Product, Order, OrderItem, Review, MembershipTier
from api.serializers import GroupBuyPublicSerializer, OrderSerializer, ReviewSerializer, MembershipTierSerializer, ProductSerializer, OrderDetailSerializer
from decimal import Decimal, ROUND_HALF_UP


class JoinGroupBuyView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        group_buy_id = kwargs.get('id') or request.data.get('group_buy_id')
        quantity = int(request.data.get('quantity', 1))
        if not group_buy_id or quantity <= 0:
            return Response({"error": "参数无效"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            group_buy = GroupBuy.objects.select_related('product').get(id=group_buy_id)
        except GroupBuy.DoesNotExist:
            return Response({"error": "拼单不存在"}, status=status.HTTP_404_NOT_FOUND)

        try:
            with transaction.atomic():
                # 使用 select_for_update 锁定拼单记录，防止并发问题
                group_buy = GroupBuy.objects.select_for_update().get(id=group_buy_id)
                product = Product.objects.select_for_update().get(id=group_buy.product_id)

                # 检查拼单状态
                if group_buy.status not in ['pending', 'active']:
                    return Response({"error": "该拼单已结束或取消"}, status=status.HTTP_400_BAD_REQUEST)

                # 检查是否会超过目标人数
                remaining_slots = group_buy.target_participants - group_buy.current_participants
                if quantity > remaining_slots:
                    return Response({
                        "error": f"参团失败：拼单仅剩 {remaining_slots} 个名额，无法加入 {quantity} 个",
                        "remaining_slots": remaining_slots
                    }, status=status.HTTP_400_BAD_REQUEST)

                # 检查库存
                if product.stock_quantity < quantity:
                    return Response({"error": "库存不足"}, status=status.HTTP_400_BAD_REQUEST)

                # 扣减库存
                product.stock_quantity -= quantity
                product.save()

                # 计算会员折扣价（如有会员等级）
                price_per_unit = product.price
                tier = getattr(request.user, 'membership_tier', None)
                if tier and getattr(tier, 'discount_percentage', None):
                    discount = (Decimal('100') - Decimal(str(tier.discount_percentage))) / Decimal('100')
                    price_per_unit = (Decimal(str(product.price)) * discount).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

                # 创建订单
                total_price = price_per_unit * quantity
                order = Order.objects.create(
                    user=request.user,
                    group_buy=group_buy,
                    total_price=total_price,
                    status='awaiting_group_success'
                )
                OrderItem.objects.create(
                    order=order,
                    product=product,
                    quantity=quantity,
                    price_per_unit=price_per_unit
                )

                # 更新拼单参与数量（按件数累计）
                group_buy.current_participants = group_buy.current_participants + quantity
                # 如果拼单原为 pending 且已到开始时间，自动激活
                now = timezone.now()
                if group_buy.status == 'pending' and group_buy.start_time <= now:
                    group_buy.status = 'active'

                # 如果达到目标人数，标记拼单和所有待成团订单为 successful
                if group_buy.current_participants >= group_buy.target_participants:
                    group_buy.status = 'successful'
                    group_buy.save()
                    Order.objects.filter(group_buy_id=group_buy.id, status='awaiting_group_success').update(status='successful')
                else:
                    group_buy.save()

        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({"error": f"参团失败：{str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({
            "message": "参团成功",
            "order_id": order.id,
            "total_price": str(order.total_price)
        }, status=status.HTTP_201_CREATED)


class GroupBuyPublicListView(generics.ListAPIView):
    serializer_class = GroupBuyPublicSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        # 显示 active 和 pending 状态的拼单（pending 表示即将开始）
        return GroupBuy.objects.select_related('product').filter(
            status__in=['active', 'pending']
        ).order_by('-created_at')


class MyOrdersView(generics.ListAPIView):
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return (
            Order.objects
            .filter(user=self.request.user)
            .select_related('group_buy', 'group_buy__product', 'group_buy__leader')
            .prefetch_related('items', 'items__product')
            .order_by('-id')
        )


class MyOrderDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, id: int):
        try:
            order = (
                Order.objects
                .select_related('user', 'group_buy', 'group_buy__product', 'group_buy__leader')
                .prefetch_related('items', 'items__product')
                .get(id=id, user=request.user)
            )
        except Order.DoesNotExist:
            return Response({'error': '订单不存在'}, status=status.HTTP_404_NOT_FOUND)
        
        serializer = OrderDetailSerializer(order, context={'request': request})
        data = serializer.data
        
        # 额外补充便于前端显示的字段
        data['user'] = {
            'username': request.user.username,
            'real_name': getattr(request.user, 'real_name', '') or request.user.username,
            'email': request.user.email,
            'phone': getattr(request.user, 'phone', ''),
        }
        
        if order.group_buy:
            # 构建完整的 group_buy 信息字典
            group_buy_data = {
                'id': order.group_buy.id,
                'product_name': getattr(order.group_buy.product, 'name', '') if order.group_buy.product else '',
                'leader_name': getattr(order.group_buy.leader, 'real_name', '') or getattr(order.group_buy.leader, 'username', '') if order.group_buy.leader else '',
                'current_participants': order.group_buy.current_participants,
                'target_participants': order.group_buy.target_participants,
                'status': order.group_buy.status,
                'start_time': order.group_buy.start_time,
                'end_time': order.group_buy.end_time,
            }
            data['group_buy'] = group_buy_data
        
        return Response(data)


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        u = request.user
        tier = u.membership_tier
        tier_data = None
        if tier:
            tier_data = MembershipTierSerializer(tier).data
        return Response({
            'id': u.id,
            'username': u.username,
            'email': u.email,
            'real_name': getattr(u, 'real_name', None),
            'loyalty_points': u.loyalty_points,
            'membership_tier': tier_data,
        })


class OrderConfirmView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, id: int):
        try:
            order = Order.objects.get(id=id, user=request.user)
        except Order.DoesNotExist:
            return Response({'error': '订单不存在'}, status=status.HTTP_404_NOT_FOUND)

        if order.status not in ('successful', 'ready_for_pickup'):
            return Response({'error': '订单当前状态不允许确认收货'}, status=status.HTTP_400_BAD_REQUEST)

        # 定义user变量
        user = request.user

        # 检查支付状态
        if getattr(order, 'payment_status', '') == 'paid':
            order.status = 'completed'
            order.save()

            # 增加积分（示例：按总价取整累加）并自动升级会员
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
            # 未支付则转为待支付，不加积分
            order.status = 'pending_payment'
            order.save()

        return Response({'ok': True, 'loyalty_points': user.loyalty_points, 'membership_tier': MembershipTierSerializer(user.membership_tier).data if user.membership_tier else None})


class OrderReviewView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, id: int):
        rating = int(request.data.get('rating', 0))
        comment = request.data.get('comment', '')
        if rating < 1 or rating > 5:
            return Response({'error': '评分需在 1-5 之间'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            order = Order.objects.prefetch_related('items', 'items__product').get(id=id, user=request.user)
        except Order.DoesNotExist:
            return Response({'error': '订单不存在'}, status=status.HTTP_404_NOT_FOUND)
        if order.status != 'completed':
            return Response({'error': '仅已完成的订单可评价'}, status=status.HTTP_400_BAD_REQUEST)
        # 简化：对订单中的首个商品创建评价
        first_item = order.items.first()
        if not first_item:
            return Response({'error': '订单无商品，无法评价'}, status=status.HTTP_400_BAD_REQUEST)
        review = Review.objects.create(
            user=request.user,
            product=first_item.product,
            rating=rating,
            comment=comment or None,
        )
        return Response(ReviewSerializer(review).data, status=status.HTTP_201_CREATED)


class ProductReviewsListView(generics.ListAPIView):
    serializer_class = ReviewSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        product_id = self.kwargs.get('id')
        return Review.objects.filter(product_id=product_id).select_related('user', 'product').order_by('-id')


class MembershipTierListView(generics.ListAPIView):
    serializer_class = MembershipTierSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return MembershipTier.objects.all().order_by('points_required')



class ProductPublicListView(generics.ListAPIView):
    serializer_class = ProductSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return Product.objects.all().order_by('name')


