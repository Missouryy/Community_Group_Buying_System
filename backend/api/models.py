from django.db import models
from django.contrib.auth.models import AbstractUser


class MembershipTier(models.Model):
    tier_name = models.CharField(max_length=50, unique=True)
    discount_percentage = models.DecimalField(max_digits=5, decimal_places=2)
    points_required = models.IntegerField()

    def __str__(self) -> str:
        return self.tier_name


class User(AbstractUser):
    ROLE_CHOICES = (
        ('admin', 'Admin'),
        ('leader', 'Leader'),
        ('user', 'User'),
    )

    # username, password, email come from AbstractUser
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='user')
    leader_status = models.CharField(max_length=10, null=True, blank=True, choices=(
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ))
    real_name = models.CharField(max_length=100, blank=True, null=True)
    id_card = models.CharField(max_length=18, blank=True, null=True)
    total_commission = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    membership_tier = models.ForeignKey(MembershipTier, on_delete=models.SET_NULL, null=True, blank=True)
    loyalty_points = models.IntegerField(default=0)


class Category(models.Model):
    name = models.CharField(max_length=100, unique=True)
    parent = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True)

    def __str__(self) -> str:
        return self.name


class Product(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    stock_quantity = models.IntegerField()
    warning_threshold = models.IntegerField(default=10)
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True)
    commission_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0.05)
    image = models.ImageField(upload_to='products/', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return self.name


class GroupBuy(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('active', 'Active'),
        ('successful', 'Successful'),
        ('failed', 'Failed'),
        ('canceled', 'Canceled'),
    )

    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    leader = models.ForeignKey(User, on_delete=models.PROTECT, related_name='led_groupbuys')
    target_participants = models.IntegerField()
    current_participants = models.IntegerField(default=0)
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"{self.product.name} - {self.status}"


class Order(models.Model):
    STATUS_CHOICES = (
        ('pending_payment', 'Pending Payment'),
        ('awaiting_group_success', 'Awaiting Group Success'),
        ('successful', 'Successful'),
        ('ready_for_pickup', 'Ready For Pickup'),
        ('completed', 'Completed'),
        ('canceled', 'Canceled'),
    )

    user = models.ForeignKey(User, on_delete=models.PROTECT)
    group_buy = models.ForeignKey(GroupBuy, on_delete=models.CASCADE)
    total_price = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=24, choices=STATUS_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    quantity = models.IntegerField()
    price_per_unit = models.DecimalField(max_digits=10, decimal_places=2)


class Review(models.Model):
    user = models.ForeignKey(User, on_delete=models.PROTECT)
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    rating = models.IntegerField()
    comment = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)


class Alert(models.Model):
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    message = models.CharField(max_length=255)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

from django.db import models

# Create your models here.
