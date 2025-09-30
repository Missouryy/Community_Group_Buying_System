from django.urls import re_path
from .websocket_consumers import GroupBuyConsumer, UserNotificationConsumer

websocket_urlpatterns = [
    re_path(r'ws/groupbuys/$', GroupBuyConsumer.as_asgi()),
    re_path(r'ws/notifications/$', UserNotificationConsumer.as_asgi()),
]
