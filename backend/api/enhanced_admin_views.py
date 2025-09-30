from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count, Sum, Q
from django.utils import timezone
from .models import GroupBuy, Order, User, Product
from .permissions import IsAdminRole


class AdminLeaderApproveView(APIView):
    """批准团长申请"""
    permission_classes = [IsAuthenticated, IsAdminRole]
    
    def post(self, request, user_id):
        try:
            user = User.objects.get(id=user_id)
            user.role = 'leader'
            user.leader_status = 'approved'
            user.save()
            
            return Response({'success': True, 'message': '团长申请已批准'})
        except User.DoesNotExist:
            return Response({'error': '用户不存在'}, status=404)
        except Exception as e:
            return Response({'error': str(e)}, status=500)


class AdminLeaderRejectView(APIView):
    """拒绝团长申请"""
    permission_classes = [IsAuthenticated, IsAdminRole]
    
    def post(self, request, user_id):
        try:
            user = User.objects.get(id=user_id)
            reason = request.data.get('reason', '')
            
            user.leader_status = 'rejected'
            user.rejection_reason = reason
            user.save()
            
            return Response({'success': True, 'message': '团长申请已拒绝'})
        except User.DoesNotExist:
            return Response({'error': '用户不存在'}, status=404)
        except Exception as e:
            return Response({'error': str(e)}, status=500)


class AdminLeaderDetailsView(APIView):
    """团长详情"""
    permission_classes = [IsAuthenticated, IsAdminRole]
    
    def get(self, request, user_id):
        try:
            user = User.objects.get(id=user_id, role='leader')
            
            # 统计数据
            groupbuy_count = GroupBuy.objects.filter(leader=user).count()
            successful_groupbuys = GroupBuy.objects.filter(
                leader=user, 
                status='completed'
            ).count()
            
            total_orders = Order.objects.filter(
                group_buy__leader=user,
                status__in=['successful', 'completed']
            ).count()
            
            # 提成计算
            orders = Order.objects.filter(
                group_buy__leader=user,
                status__in=['successful', 'completed']
            )
            total_commission = sum(order.total_price * 0.1 for order in orders)
            
            # 本月提成
            current_month = timezone.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            monthly_orders = orders.filter(created_at__gte=current_month)
            monthly_commission = sum(order.total_price * 0.1 for order in monthly_orders)
            
            # 最近拼单
            recent_groupbuys = GroupBuy.objects.filter(
                leader=user
            ).select_related('product').order_by('-created_at')[:5]
            
            recent_gb_data = []
            for gb in recent_groupbuys:
                recent_gb_data.append({
                    'id': gb.id,
                    'product_name': gb.product.name if gb.product else '未知商品',
                    'current_participants': gb.current_participants,
                    'target_participants': gb.target_participants,
                    'status': gb.status,
                    'created_at': gb.created_at.isoformat()
                })
            
            return Response({
                'id': user.id,
                'username': user.username,
                'real_name': user.real_name,
                'email': user.email,
                'phone': getattr(user, 'phone', ''),
                'address': getattr(user, 'address', ''),
                'date_joined': user.date_joined.isoformat(),
                'groupbuy_count': groupbuy_count,
                'successful_groupbuys': successful_groupbuys,
                'total_orders': total_orders,
                'total_commission': f"{total_commission:.2f}",
                'monthly_commission': f"{monthly_commission:.2f}",
                'recent_groupbuys': recent_gb_data
            })
        except User.DoesNotExist:
            return Response({'error': '团长不存在'}, status=404)
        except Exception as e:
            return Response({'error': str(e)}, status=500)


class AdminLeaderDeactivateView(APIView):
    """停用团长"""
    permission_classes = [IsAuthenticated, IsAdminRole]
    
    def post(self, request, user_id):
        try:
            user = User.objects.get(id=user_id, role='leader')
            user.is_active = False
            user.save()
            
            return Response({'success': True, 'message': '团长已停用'})
        except User.DoesNotExist:
            return Response({'error': '团长不存在'}, status=404)
        except Exception as e:
            return Response({'error': str(e)}, status=500)
