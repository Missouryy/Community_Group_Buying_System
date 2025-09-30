from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import User, Product, Category, GroupBuy, Order, OrderItem, Review, MembershipTier, Alert


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['role'] = user.role
        return token


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'


class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = '__all__'


class GroupBuySerializer(serializers.ModelSerializer):
    class Meta:
        model = GroupBuy
        fields = '__all__'
        read_only_fields = ['leader', 'status', 'current_participants', 'created_at']


class GroupBuyPublicSerializer(serializers.ModelSerializer):
    product_name = serializers.SerializerMethodField()
    product_price = serializers.SerializerMethodField()
    product_image_url = serializers.SerializerMethodField()
    product_stock = serializers.SerializerMethodField()

    class Meta:
        model = GroupBuy
        fields = (
            'id', 'target_participants', 'current_participants',
            'start_time', 'end_time', 'status',
            'product', 'product_name', 'product_price', 'product_image_url',
            'product_stock'
        )

    def get_product_name(self, obj):
        return getattr(obj.product, 'name', None)

    def get_product_price(self, obj):
        return getattr(obj.product, 'price', None)

    def get_product_image_url(self, obj):
        img = getattr(obj.product, 'image', None)
        request = self.context.get('request') if hasattr(self, 'context') else None
        if img:
            url = img.url
            if request and not url.startswith('http'):
                return request.build_absolute_uri(url)
            return url
        return None

    def get_product_stock(self, obj):
        return getattr(obj.product, 'stock_quantity', None)


class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = '__all__'


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = '__all__'


class OrderDetailSerializer(serializers.ModelSerializer):
    """订单详情序列化器，包含更多关联信息"""
    items = OrderItemSerializer(many=True, read_only=True)
    user_name = serializers.CharField(source='user.real_name', read_only=True)
    user_phone = serializers.CharField(source='user.phone', read_only=True)
    product_name = serializers.CharField(source='group_buy.product.name', read_only=True)
    leader_name = serializers.CharField(source='group_buy.leader.real_name', read_only=True)

    class Meta:
        model = Order
        fields = '__all__'


class ReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = Review
        fields = '__all__'


class MembershipTierSerializer(serializers.ModelSerializer):
    class Meta:
        model = MembershipTier
        fields = '__all__'


class AlertSerializer(serializers.ModelSerializer):
    class Meta:
        model = Alert
        fields = '__all__'


