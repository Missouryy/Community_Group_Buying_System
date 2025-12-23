from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count, Sum
from django.utils import timezone
from decimal import Decimal
from api.models import User, Order, Product, GroupBuy
from api.serializers import MembershipTierSerializer


class UserApplyLeaderView(APIView):
    """用户申请成为团长"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        try:
            user = request.user
            
            # 管理员不能申请成为团长
            if user.role == 'admin':
                return Response({
                    'error': '管理员不能申请成为团长',
                    'detail': '管理员账户已拥有最高权限，无需申请团长角色'
                }, status=400)
            
            # 如果已经是团长，不能重复申请
            if user.role == 'leader':
                return Response({
                    'error': '您已经是团长了',
                    'detail': '无需重复申请'
                }, status=400)
            
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


class MeDetailView(APIView):
    """用户信息视图"""
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
            # 假设原价 = 拼单价 * 1.2，则每件节省 = 拼单价 * 0.2
            user_orders = (
                Order.objects
                .filter(user=user, status__in=['successful', 'completed'])
                .prefetch_related('items', 'items__product')
            )
            total_savings = Decimal('0')
            for order in user_orders:
                for item in order.items.all():
                    product_price = getattr(item.product, 'price', 0) or Decimal('0')
                    savings_per_unit = product_price * Decimal('0.2')
                    total_savings += savings_per_unit * Decimal(str(item.quantity or 0))
            
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
                'application_reason': getattr(user, 'application_reason', ''),
                'rejection_reason': getattr(user, 'rejection_reason', ''),
                'date_joined': user.date_joined.isoformat(),
                'loyalty_points': getattr(user, 'loyalty_points', 0),
                'membership_tier': MembershipTierSerializer(getattr(user, 'membership_tier', None)).data if getattr(user, 'membership_tier', None) else None,
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
