from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import User, Product, Category, GroupBuy, Order, OrderItem, Review, MembershipTier, Alert


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['role'] = user.role
        return token


class UserRegisterSerializer(serializers.ModelSerializer):
    """用户注册序列化器"""
    password = serializers.CharField(write_only=True, required=True, min_length=6)
    email = serializers.EmailField(required=False, allow_blank=True)
    
    class Meta:
        model = User
        fields = ['username', 'email', 'password']
    
    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("用户名已存在")
        return value
    
    def validate_email(self, value):
        if value and User.objects.filter(email=value).exists():
            raise serializers.ValidationError("邮箱已被注册")
        return value
    
    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password']
        )
        return user


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'


class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = '__all__'


class GroupBuySerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)

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
    """订单列表序列化器，包含便于前端显示的额外字段"""
    items = OrderItemSerializer(many=True, read_only=True)
    product_name = serializers.SerializerMethodField()
    leader_name = serializers.SerializerMethodField()
    price_per_unit = serializers.SerializerMethodField()
    quantity = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = '__all__'

    def get_product_name(self, obj):
        try:
            return obj.group_buy.product.name if obj.group_buy and obj.group_buy.product else '未知商品'
        except:
            return '未知商品'

    def get_leader_name(self, obj):
        try:
            if obj.group_buy and obj.group_buy.leader:
                return obj.group_buy.leader.real_name or obj.group_buy.leader.username
            return '未知团长'
        except:
            return '未知团长'

    def get_price_per_unit(self, obj):
        try:
            # 优先从 OrderItem 获取单价
            first_item = obj.items.first()
            if first_item:
                return str(first_item.price_per_unit)
            # 降级从拼单商品获取
            if obj.group_buy and obj.group_buy.product:
                return str(obj.group_buy.product.price)
            return '0.00'
        except:
            return '0.00'

    def get_quantity(self, obj):
        try:
            # 汇总所有 OrderItem 的数量
            total = sum(item.quantity for item in obj.items.all())
            return total if total > 0 else 1
        except:
            return 1


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


