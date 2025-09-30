"""WebSocket推送工具函数"""
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
import json


channel_layer = get_channel_layer()


def send_groupbuy_update(groupbuy_id, data):
    """发送拼单更新推送"""
    if not channel_layer:
        return
    
    room_group_name = f'groupbuy_{groupbuy_id}'
    
    async_to_sync(channel_layer.group_send)(
        room_group_name,
        {
            'type': 'groupbuy_update',
            'data': {
                'type': 'groupbuy_update',
                'groupbuy_id': groupbuy_id,
                'data': data,
                'timestamp': str(timezone.now())
            }
        }
    )


def send_groupbuy_success(groupbuy_id, data):
    """发送拼单成功推送"""
    if not channel_layer:
        return
    
    # 发送到拼单房间
    room_group_name = f'groupbuy_{groupbuy_id}'
    async_to_sync(channel_layer.group_send)(
        room_group_name,
        {
            'type': 'groupbuy_success',
            'data': {
                'type': 'groupbuy_success',
                'groupbuy_id': groupbuy_id,
                'data': data,
                'timestamp': str(timezone.now())
            }
        }
    )
    
    # 同时发送到全局拼单更新房间
    global_room = 'groupbuy_groupbuy_updates'
    async_to_sync(channel_layer.group_send)(
        global_room,
        {
            'type': 'groupbuy_success',
            'data': {
                'type': 'groupbuy_success',
                'groupbuy_id': groupbuy_id,
                'data': data,
                'timestamp': str(timezone.now())
            }
        }
    )


def send_new_groupbuy(data):
    """发送新拼单推送"""
    if not channel_layer:
        return
    
    room_group_name = 'groupbuy_groupbuy_updates'
    
    async_to_sync(channel_layer.group_send)(
        room_group_name,
        {
            'type': 'new_groupbuy',
            'data': {
                'type': 'new_groupbuy',
                'data': data,
                'timestamp': str(timezone.now())
            }
        }
    )


def send_user_notification(user_id, notification_type, data):
    """发送用户个人通知"""
    if not channel_layer:
        return
    
    room_group_name = f'user_{user_id}'
    
    async_to_sync(channel_layer.group_send)(
        room_group_name,
        {
            'type': notification_type,
            'data': {
                'type': notification_type,
                'data': data,
                'timestamp': str(timezone.now())
            }
        }
    )


def send_order_update(user_id, order_id, status, data=None):
    """发送订单状态更新通知"""
    notification_data = {
        'order_id': order_id,
        'status': status,
        'message': f'您的订单 #{order_id} 状态已更新为 {status}'
    }
    
    if data:
        notification_data.update(data)
    
    send_user_notification(user_id, 'order_update', notification_data)


def send_groupbuy_joined_notification(groupbuy_id, user_id, joined_user_name):
    """发送有人加入拼单的通知"""
    notification_data = {
        'groupbuy_id': groupbuy_id,
        'joined_user': joined_user_name,
        'message': f'{joined_user_name} 加入了拼单'
    }
    
    send_user_notification(user_id, 'groupbuy_joined', notification_data)


def send_leader_notification(leader_id, notification_type, data):
    """发送团长相关通知"""
    send_user_notification(leader_id, 'leader_notification', {
        'notification_type': notification_type,
        'data': data
    })


# 导入timezone
from django.utils import timezone
