import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from .models import GroupBuy, Order

User = get_user_model()


class GroupBuyConsumer(AsyncWebsocketConsumer):
    """拼单状态推送WebSocket消费者"""
    
    async def connect(self):
        self.room_name = 'groupbuy_updates'
        self.room_group_name = f'groupbuy_{self.room_name}'
        
        # 加入房间组
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
        await self.accept()
        
        # 发送连接成功消息
        await self.send(text_data=json.dumps({
            'type': 'connection_established',
            'message': '已连接到拼单更新服务'
        }))
    
    async def disconnect(self, close_code):
        # 离开房间组
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )
    
    async def receive(self, text_data):
        """处理客户端消息"""
        try:
            text_data_json = json.loads(text_data)
            message_type = text_data_json.get('type')
            
            if message_type == 'join_groupbuy':
                # 客户端要求监听特定拼单
                groupbuy_id = text_data_json.get('groupbuy_id')
                if groupbuy_id:
                    await self.join_groupbuy_room(groupbuy_id)
            elif message_type == 'leave_groupbuy':
                # 离开特定拼单监听
                groupbuy_id = text_data_json.get('groupbuy_id')
                if groupbuy_id:
                    await self.leave_groupbuy_room(groupbuy_id)
                    
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': '无效的JSON格式'
            }))
    
    async def join_groupbuy_room(self, groupbuy_id):
        """加入特定拼单房间"""
        room_group_name = f'groupbuy_{groupbuy_id}'
        await self.channel_layer.group_add(
            room_group_name,
            self.channel_name
        )
        
        await self.send(text_data=json.dumps({
            'type': 'joined_groupbuy',
            'groupbuy_id': groupbuy_id,
            'message': f'已加入拼单 {groupbuy_id} 的更新推送'
        }))
    
    async def leave_groupbuy_room(self, groupbuy_id):
        """离开特定拼单房间"""
        room_group_name = f'groupbuy_{groupbuy_id}'
        await self.channel_layer.group_discard(
            room_group_name,
            self.channel_name
        )
        
        await self.send(text_data=json.dumps({
            'type': 'left_groupbuy',
            'groupbuy_id': groupbuy_id,
            'message': f'已离开拼单 {groupbuy_id} 的更新推送'
        }))
    
    # 接收来自房间组的消息
    async def groupbuy_update(self, event):
        """处理拼单更新消息"""
        await self.send(text_data=json.dumps(event['data']))
    
    async def groupbuy_success(self, event):
        """处理拼单成功消息"""
        await self.send(text_data=json.dumps(event['data']))
    
    async def new_groupbuy(self, event):
        """处理新拼单消息"""
        await self.send(text_data=json.dumps(event['data']))


class UserNotificationConsumer(AsyncWebsocketConsumer):
    """用户个人通知WebSocket消费者"""
    
    async def connect(self):
        self.user = self.scope["user"]
        
        if self.user.is_anonymous:
            await self.close()
            return
        
        self.room_group_name = f'user_{self.user.id}'
        
        # 加入用户个人房间
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
        await self.accept()
        
        # 发送连接成功消息
        await self.send(text_data=json.dumps({
            'type': 'connection_established',
            'message': '已连接到个人通知服务'
        }))
    
    async def disconnect(self, close_code):
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )
    
    async def receive(self, text_data):
        """处理客户端消息"""
        try:
            text_data_json = json.loads(text_data)
            message_type = text_data_json.get('type')
            
            if message_type == 'mark_read':
                # 标记通知为已读
                notification_id = text_data_json.get('notification_id')
                if notification_id:
                    await self.mark_notification_read(notification_id)
                    
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': '无效的JSON格式'
            }))
    
    @database_sync_to_async
    def mark_notification_read(self, notification_id):
        """标记通知为已读"""
        # 这里可以实现通知已读逻辑
        pass
    
    # 接收来自房间组的消息
    async def order_update(self, event):
        """订单状态更新通知"""
        await self.send(text_data=json.dumps(event['data']))
    
    async def groupbuy_joined(self, event):
        """有人加入你关注的拼单"""
        await self.send(text_data=json.dumps(event['data']))
    
    async def leader_notification(self, event):
        """团长相关通知"""
        await self.send(text_data=json.dumps(event['data']))
    
    async def system_notification(self, event):
        """系统通知"""
        await self.send(text_data=json.dumps(event['data']))
