from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .admin_views import (
    AdminProductViewSet, LeaderApplicationsListView, LeaderApplicationDetailView,
    AdminAlertListView, AdminAlertMarkReadView, AdminStatsView, AdminSalesDailyView
)
from .leader_views import LeaderGroupBuyListCreateView, LeaderGroupBuyOrdersView, LeaderConfirmPickupView
from .user_views import (
    JoinGroupBuyView, GroupBuyPublicListView, MyOrdersView,
    MeView, OrderConfirmView, OrderReviewView, ProductReviewsListView,
    MembershipTierListView, ProductPublicListView
)

router = DefaultRouter()
router.register(r'admin/products', AdminProductViewSet, basename='admin-products')

urlpatterns = [
    path('', include(router.urls)),
    path('leader/groupbuys/', LeaderGroupBuyListCreateView.as_view(), name='leader-groupbuys'),
    path('leader/groupbuys/<int:id>/orders/', LeaderGroupBuyOrdersView.as_view(), name='leader-groupbuys-orders'),
    path('leader/orders/<int:id>/pickup/', LeaderConfirmPickupView.as_view(), name='leader-orders-pickup'),
    path('groupbuys/', GroupBuyPublicListView.as_view(), name='groupbuys-list'),
    path('products/', ProductPublicListView.as_view(), name='products-public-list'),
    path('group-buys/<int:id>/join/', JoinGroupBuyView.as_view(), name='group-buys-join'),
    path('orders/join/', JoinGroupBuyView.as_view(), name='orders-join'),
    path('me/orders/', MyOrdersView.as_view(), name='me-orders'),
    path('users/me/', MeView.as_view(), name='users-me'),
    path('memberships/tiers/', MembershipTierListView.as_view(), name='memberships-tiers'),
    path('orders/<int:id>/confirm/', OrderConfirmView.as_view(), name='orders-confirm'),
    path('orders/<int:id>/review/', OrderReviewView.as_view(), name='orders-review'),
    path('products/<int:id>/reviews/', ProductReviewsListView.as_view(), name='products-reviews'),
    path('admin/leader-applications/', LeaderApplicationsListView.as_view(), name='admin-leader-applications'),
    path('admin/leader-applications/<int:user_id>/', LeaderApplicationDetailView.as_view(), name='admin-leader-applications-detail'),
    path('admin/alerts/', AdminAlertListView.as_view(), name='admin-alerts'),
    path('admin/alerts/<int:alert_id>/read/', AdminAlertMarkReadView.as_view(), name='admin-alerts-read'),
    path('admin/stats/', AdminStatsView.as_view(), name='admin-stats'),
    path('admin/sales/daily/', AdminSalesDailyView.as_view(), name='admin-sales-daily'),
]


