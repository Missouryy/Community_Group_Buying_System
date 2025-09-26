from django.db import transaction
from rest_framework import status, permissions, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from .models import GroupBuy, Product, Order, OrderItem, Review, MembershipTier
from .serializers import GroupBuyPublicSerializer, OrderSerializer, ReviewSerializer, MembershipTierSerializer, ProductSerializer
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
                product = Product.objects.select_for_update().get(id=group_buy.product_id)

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

                # 更新拼单参与人数
                group_buy.current_participants = group_buy.current_participants + 1
                group_buy.save()

        except Exception:
            return Response({"error": "参团失败，请稍后重试"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({"message": "参团成功"}, status=status.HTTP_201_CREATED)


class GroupBuyPublicListView(generics.ListAPIView):
    serializer_class = GroupBuyPublicSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return GroupBuy.objects.select_related('product').filter(status='active').order_by('-id')


class MyOrdersView(generics.ListAPIView):
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return (
            Order.objects
            .filter(user=self.request.user)
            .order_by('-id')
            .prefetch_related('items', 'items__product', 'group_buy')
        )


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

        order.status = 'completed'
        order.save()

        # 增加积分（示例：按总价取整累加）并自动升级会员
        user = request.user
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


