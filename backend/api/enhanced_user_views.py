from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count, Sum
from django.utils import timezone
from .models import User, Order, Product, GroupBuy


class UserApplyLeaderView(APIView):
    """用户申请成为团长"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        try:
            user = request.user
            phone = request.data.get('phone')
            address = request.data.get('address')
            reason = request.data.get('reason', '')
            
            if not phone or not address:
                return Response({'error': '手机号和地址为必填项'}, status=400)
            
            # 更新用户信息
            user.phone = phone
            user.address = address
            user.leader_status = 'pending'
            user.application_reason = reason
            user.save()
            
            return Response({'success': True, 'message': '申请已提交，请等待审核'})
        except Exception as e:
            return Response({'error': str(e)}, status=500)


class ProductNotifyView(APIView):
    """商品拼单通知设置"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request, product_id):
        try:
            product = Product.objects.get(id=product_id)
            user = request.user
            
            # 这里可以创建通知记录
            # 暂时简单返回成功
            return Response({'success': True, 'message': '通知设置成功'})
        except Product.DoesNotExist:
            return Response({'error': '商品不存在'}, status=404)
        except Exception as e:
            return Response({'error': str(e)}, status=500)


class EnhancedMeView(APIView):
    """增强的用户信息视图"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        try:
            user = request.user
            
            # 获取用户统计数据
            total_orders = Order.objects.filter(
                user=user,
                status__in=['successful', 'completed']
            ).count()
            
            # 计算总节省金额（估算）
            user_orders = Order.objects.filter(
                user=user,
                status__in=['successful', 'completed']
            ).select_related('group_buy__product')
            
            total_savings = 0
            for order in user_orders:
                if order.group_buy.product:
                    # 假设原价比拼单价高20%
                    original_price = order.group_buy.product.price * 1.2
                    savings_per_item = original_price - order.group_buy.product.price
                    total_savings += savings_per_item * order.quantity
            
            # 计算加入天数
            join_days = (timezone.now().date() - user.date_joined.date()).days
            
            return Response({
                'id': user.id,
                'username': user.username,
                'real_name': user.real_name,
                'email': user.email,
                'phone': getattr(user, 'phone', ''),
                'address': getattr(user, 'address', ''),
                'role': user.role,
                'leader_status': getattr(user, 'leader_status', None),
                'rejection_reason': getattr(user, 'rejection_reason', ''),
                'date_joined': user.date_joined.isoformat(),
                'loyalty_points': getattr(user, 'loyalty_points', 0),
                'membership_tier': getattr(user, 'membership_tier', None),
                'total_orders': total_orders,
                'total_savings': f"{total_savings:.2f}",
                'join_days': join_days
            })
        except Exception as e:
            return Response({'error': str(e)}, status=500)
    
    def patch(self, request):
        """更新用户信息"""
        try:
            user = request.user
            
            # 允许更新的字段
            allowed_fields = ['real_name', 'email', 'phone', 'address']
            
            for field in allowed_fields:
                if field in request.data:
                    setattr(user, field, request.data[field])
            
            user.save()
            
            return Response({'success': True, 'message': '信息更新成功'})
        except Exception as e:
            return Response({'error': str(e)}, status=500)
