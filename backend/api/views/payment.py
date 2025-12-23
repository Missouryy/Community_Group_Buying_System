from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.conf import settings
from django.utils import timezone
import hashlib
import time
import random
import string
import json
import requests
from api.models import Order, GroupBuy
from api.websocket_utils import send_order_update


class WeChatPayView(APIView):
    """微信支付接口"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        try:
            order_id = request.data.get('order_id')
            if not order_id:
                return Response({'error': '缺少订单ID'}, status=400)
            
            # 获取订单信息
            try:
                order = Order.objects.get(id=order_id, user=request.user)
            except Order.DoesNotExist:
                return Response({'error': '订单不存在'}, status=404)
            
            if order.payment_status == 'paid':
                return Response({'error': '订单已支付'}, status=400)
            
            # 生成微信支付参数
            pay_params = self.generate_wechat_pay_params(order)
            
            return Response({
                'success': True,
                'pay_params': pay_params,
                'order_id': order_id,
                'amount': str(order.total_price)
            })
            
        except Exception as e:
            return Response({'error': f'支付请求失败: {str(e)}'}, status=500)
    
    def generate_wechat_pay_params(self, order):
        """生成微信支付参数"""
        # 注意：这是示例代码，实际使用时需要配置真实的微信支付参数
        
        # 微信支付配置（需要在settings中配置）
        app_id = getattr(settings, 'WECHAT_APP_ID', 'demo_app_id')
        mch_id = getattr(settings, 'WECHAT_MCH_ID', 'demo_mch_id')
        key = getattr(settings, 'WECHAT_PAY_KEY', 'demo_key')
        notify_url = getattr(settings, 'WECHAT_PAY_NOTIFY_URL', 'http://localhost:8000/api/payment/wechat/notify/')
        
        # 生成订单号
        out_trade_no = f"GB{order.id}_{int(time.time())}"
        
        # 准备参数
        params = {
            'appid': app_id,
            'mch_id': mch_id,
            'nonce_str': self.generate_nonce_str(),
            'body': f'社区团购-{order.group_buy.product.name if order.group_buy.product else "商品"}',
            'out_trade_no': out_trade_no,
            'total_fee': int(order.total_price * 100),  # 微信支付金额单位为分
            'spbill_create_ip': '127.0.0.1',
            'notify_url': notify_url,
            'trade_type': 'JSAPI',
            'openid': getattr(request.user, 'wechat_openid', 'demo_openid')
        }
        
        # 生成签名
        params['sign'] = self.generate_sign(params, key)
        
        # 在实际应用中，这里应该调用微信支付API
        # 这里返回模拟的支付参数
        return {
            'appId': app_id,
            'timeStamp': str(int(time.time())),
            'nonceStr': self.generate_nonce_str(),
            'package': f'prepay_id=demo_prepay_id_{order.id}',
            'signType': 'MD5',
            'paySign': 'demo_pay_sign'
        }
    
    def generate_nonce_str(self, length=32):
        """生成随机字符串"""
        return ''.join(random.choices(string.ascii_letters + string.digits, k=length))
    
    def generate_sign(self, params, key):
        """生成微信支付签名"""
        # 排序参数
        sorted_params = sorted(params.items())
        # 拼接字符串
        query_string = '&'.join([f'{k}={v}' for k, v in sorted_params if v])
        # 添加key
        query_string += f'&key={key}'
        # MD5加密
        return hashlib.md5(query_string.encode('utf-8')).hexdigest().upper()


class WeChatPayNotifyView(APIView):
    """微信支付回调接口"""
    
    def post(self, request):
        try:
            # 解析微信支付回调数据
            # 实际应用中需要验证签名和处理XML数据
            
            # 模拟处理支付成功回调
            out_trade_no = request.data.get('out_trade_no', '')
            result_code = request.data.get('result_code', 'SUCCESS')
            
            if result_code == 'SUCCESS' and out_trade_no:
                # 提取订单ID
                if out_trade_no.startswith('GB'):
                    order_id = out_trade_no.split('_')[0][2:]  # 去掉GB前缀
                    
                    try:
                        order = Order.objects.get(id=order_id)
                        
                        # 更新订单支付状态
                        order.payment_status = 'paid'
                        order.payment_time = timezone.now()
                        order.save()
                        
                        # 发送支付成功通知
                        send_order_update(
                            order.user.id,
                            order.id,
                            'payment_success',
                            {'message': '支付成功，等待拼单结果'}
                        )
                        
                        # 检查拼单是否成功
                        self.check_groupbuy_success(order.group_buy)
                        
                    except Order.DoesNotExist:
                        pass
            
            # 返回微信支付要求的响应格式
            return Response('<xml><return_code><![CDATA[SUCCESS]]></return_code></xml>', 
                          content_type='application/xml')
            
        except Exception as e:
            return Response('<xml><return_code><![CDATA[FAIL]]></return_code></xml>', 
                          content_type='application/xml')
    
    def check_groupbuy_success(self, group_buy):
        """检查拼单是否达成目标"""
        paid_orders_count = Order.objects.filter(
            group_buy=group_buy,
            payment_status='paid'
        ).count()
        
        if paid_orders_count >= group_buy.target_participants:
            # 拼单成功，更新状态
            group_buy.status = 'successful'
            group_buy.save()
            
            # 更新所有相关订单状态
            orders = Order.objects.filter(group_buy=group_buy, payment_status='paid')
            for order in orders:
                order.status = 'successful'
                order.save()
                
                # 发送拼单成功通知
                send_order_update(
                    order.user.id,
                    order.id,
                    'groupbuy_success',
                    {'message': '拼单成功！等待团长安排提货'}
                )


class AlipayView(APIView):
    """支付宝支付接口"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        try:
            order_id = request.data.get('order_id')
            if not order_id:
                return Response({'error': '缺少订单ID'}, status=400)
            
            # 获取订单信息
            try:
                order = Order.objects.get(id=order_id, user=request.user)
            except Order.DoesNotExist:
                return Response({'error': '订单不存在'}, status=404)
            
            if order.payment_status == 'paid':
                return Response({'error': '订单已支付'}, status=400)
            
            # 生成支付宝支付参数（示例）
            pay_params = {
                'orderString': f'alipay_order_{order.id}_{int(time.time())}',
                'amount': str(order.total_price),
                'subject': f'社区团购-{order.group_buy.product.name if order.group_buy.product else "商品"}'
            }
            
            return Response({
                'success': True,
                'pay_params': pay_params,
                'order_id': order_id,
                'amount': str(order.total_price)
            })
            
        except Exception as e:
            return Response({'error': f'支付请求失败: {str(e)}'}, status=500)


class PaymentStatusView(APIView):
    """支付状态查询接口"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request, order_id):
        try:
            order = Order.objects.get(id=order_id, user=request.user)
            
            return Response({
                'order_id': order.id,
                'payment_status': order.payment_status,
                'payment_time': order.payment_time.isoformat() if order.payment_time else None,
                'order_status': order.status,
                'total_price': str(order.total_price)
            })
            
        except Order.DoesNotExist:
            return Response({'error': '订单不存在'}, status=404)
        except Exception as e:
            return Response({'error': str(e)}, status=500)
