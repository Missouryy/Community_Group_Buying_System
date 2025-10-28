from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .admin_views import (
    AdminProductViewSet, LeaderApplicationsListView, LeaderApplicationDetailView,
    AdminAlertListView, AdminAlertMarkReadView, AdminStatsView, AdminSalesDailyView,
    AdminOrderListView, AdminOrderDetailView, AdminOrderUpdateStatusView,
    AdminOrderBatchUpdateView, AdminOrderCancelView
)
from .leader_views import LeaderGroupBuyListCreateView, LeaderGroupBuyOrdersView, LeaderConfirmPickupView, LeaderStartGroupBuyView
from .user_views import (
    JoinGroupBuyView, GroupBuyPublicListView, MyOrdersView, MyOrderDetailView,
    MeView, OrderConfirmView, OrderReviewView, ProductReviewsListView,
    MembershipTierListView, ProductPublicListView
)
# 新增的增强视图
from .stats_views import (
    PublicStatsView, SuccessfulGroupBuysView, FeaturedLeadersView, RecommendationsView
)
from .leader_extras import (
    LeaderStatsView, LeaderPickupsView, LeaderCommissionsSummaryView, LeaderCommissionsView, LeaderDemoteToUserView
)
from .admin_extras import (
    AdminLeaderApproveView, AdminLeaderRejectView, AdminLeaderDetailsView, AdminLeaderDeactivateView
)
from .user_extras import (
    UserApplyLeaderView, ProductNotifyView, MeDetailView
)
from .image_upload_views import (
    ImageUploadView, ProductImageUploadView
)
from .payment_views import (
    WeChatPayView, WeChatPayNotifyView, AlipayView, PaymentStatusView
)
from .analytics_views import (
    UserBehaviorTrackingView, AdminAnalyticsView, DailyStatsView
)

router = DefaultRouter()
router.register(r'admin/products', AdminProductViewSet, basename='admin-products')

urlpatterns = [
    path('', include(router.urls)),
    
    # 原有的API端点
    path('leader/groupbuys/', LeaderGroupBuyListCreateView.as_view(), name='leader-groupbuys'),
    path('leader/groupbuys/<int:id>/orders/', LeaderGroupBuyOrdersView.as_view(), name='leader-groupbuys-orders'),
    path('leader/groupbuys/<int:id>/start/', LeaderStartGroupBuyView.as_view(), name='leader-groupbuys-start'),
    path('leader/orders/<int:id>/pickup/', LeaderConfirmPickupView.as_view(), name='leader-orders-pickup'),
    path('groupbuys/', GroupBuyPublicListView.as_view(), name='groupbuys-list'),
    path('products/', ProductPublicListView.as_view(), name='products-public-list'),
    path('group-buys/<int:id>/join/', JoinGroupBuyView.as_view(), name='group-buys-join'),
    path('orders/join/', JoinGroupBuyView.as_view(), name='orders-join'),
    path('me/orders/', MyOrdersView.as_view(), name='me-orders'),
    path('me/orders/<int:id>/', MyOrderDetailView.as_view(), name='me-orders-detail'),
    path('users/me/', MeDetailView.as_view(), name='users-me'),
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
    
    # 管理员订单管理API
    path('admin/orders/', AdminOrderListView.as_view(), name='admin-orders-list'),
    path('admin/orders/<int:order_id>/', AdminOrderDetailView.as_view(), name='admin-order-detail'),
    path('admin/orders/<int:order_id>/status/', AdminOrderUpdateStatusView.as_view(), name='admin-order-update-status'),
    path('admin/orders/batch-update/', AdminOrderBatchUpdateView.as_view(), name='admin-orders-batch-update'),
    path('admin/orders/<int:order_id>/cancel/', AdminOrderCancelView.as_view(), name='admin-order-cancel'),
    
    # 新增的统计和推荐API
    path('stats/', PublicStatsView.as_view(), name='public-stats'),
    path('groupbuys/successful/', SuccessfulGroupBuysView.as_view(), name='successful-groupbuys'),
    path('leaders/featured/', FeaturedLeadersView.as_view(), name='featured-leaders'),
    path('recommendations/', RecommendationsView.as_view(), name='recommendations'),
    
    # 新增的团长功能API
    path('leader/stats/', LeaderStatsView.as_view(), name='leader-stats'),
    path('leader/pickups/', LeaderPickupsView.as_view(), name='leader-pickups'),
    path('leader/commissions/summary/', LeaderCommissionsSummaryView.as_view(), name='leader-commissions-summary'),
    path('leader/commissions/', LeaderCommissionsView.as_view(), name='leader-commissions'),
    path('leader/demote/', LeaderDemoteToUserView.as_view(), name='leader-demote'),
    
    # 新增的管理员功能API
    path('admin/leaders/<int:user_id>/approve/', AdminLeaderApproveView.as_view(), name='admin-leader-approve'),
    path('admin/leaders/<int:user_id>/reject/', AdminLeaderRejectView.as_view(), name='admin-leader-reject'),
    path('admin/leaders/<int:user_id>/details/', AdminLeaderDetailsView.as_view(), name='admin-leader-details'),
    path('admin/leaders/<int:user_id>/deactivate/', AdminLeaderDeactivateView.as_view(), name='admin-leader-deactivate'),
    
    # 新增的用户功能API
    path('users/apply-leader/', UserApplyLeaderView.as_view(), name='user-apply-leader'),
    path('products/<int:product_id>/notify/', ProductNotifyView.as_view(), name='product-notify'),
    
    # 图片上传API
    path('upload/image/', ImageUploadView.as_view(), name='image-upload'),
    path('products/<int:product_id>/upload-image/', ProductImageUploadView.as_view(), name='product-image-upload'),
    
    # 支付API
    path('payment/wechat/', WeChatPayView.as_view(), name='wechat-pay'),
    path('payment/wechat/notify/', WeChatPayNotifyView.as_view(), name='wechat-pay-notify'),
    path('payment/alipay/', AlipayView.as_view(), name='alipay'),
    path('payment/status/<int:order_id>/', PaymentStatusView.as_view(), name='payment-status'),
    
    # 数据分析API
    path('analytics/behavior/', UserBehaviorTrackingView.as_view(), name='user-behavior-tracking'),
    path('admin/analytics/', AdminAnalyticsView.as_view(), name='admin-analytics'),
    path('admin/analytics/daily/', DailyStatsView.as_view(), name='daily-stats'),
]


