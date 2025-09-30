from celery import shared_task
from django.utils import timezone
from django.db import transaction
from .models import GroupBuy, Order, OrderItem, Product
from django.db import models


def _cancel_expired_group_buys_core() -> int:
    count = 0
    expired = GroupBuy.objects.filter(end_time__lt=timezone.now(), status='active')
    for gb in expired:
        with transaction.atomic():
            orders_to_cancel = Order.objects.filter(group_buy_id=gb.id, status='awaiting_group_success')

            # rollback stock for each order
            for order in orders_to_cancel.select_related('group_buy').prefetch_related('items'):
                for item in order.items.all():
                    Product.objects.filter(id=item.product_id).update(
                        stock_quantity=models.F('stock_quantity') + item.quantity
                    )

            updated = orders_to_cancel.update(status='canceled')
            gb.status = 'failed'
            gb.save()
            count += 1
    return count


@shared_task
def cancel_expired_groupbuys():
    # 保持兼容的旧任务名（每次调用返回处理的拼单数）
    return _cancel_expired_group_buys_core()


@shared_task
def cancel_expired_group_buys():
    # 新任务名，供 Celery Beat 调度使用
    return _cancel_expired_group_buys_core()


def _activate_pending_groupbuys_core() -> int:
    now = timezone.now()
    updated = GroupBuy.objects.filter(status='pending', start_time__lte=now).update(status='active')
    return updated


def _finalize_groupbuys_core() -> int:
    now = timezone.now()
    processed = 0
    # 成功：到达或超过目标人数且在结束时间或之后
    success_candidates = GroupBuy.objects.filter(status__in=['active', 'pending'], end_time__lte=now)
    for gb in success_candidates.select_related('product'):
        if gb.current_participants >= gb.target_participants:
            gb.status = 'successful'
            gb.save()
            # 更新相关订单到 successful
            Order.objects.filter(group_buy_id=gb.id, status='awaiting_group_success').update(status='successful')
            processed += 1
        else:
            # 走失败逻辑（与过期取消一致）：退库存并取消订单
            with transaction.atomic():
                orders_to_cancel = Order.objects.filter(group_buy_id=gb.id, status='awaiting_group_success')
                for order in orders_to_cancel.select_related('group_buy').prefetch_related('items'):
                    for item in order.items.all():
                        Product.objects.filter(id=item.product_id).update(
                            stock_quantity=models.F('stock_quantity') + item.quantity
                        )
                orders_to_cancel.update(status='canceled')
                gb.status = 'failed'
                gb.save()
                processed += 1
    return processed


@shared_task
def activate_pending_groupbuys():
    return _activate_pending_groupbuys_core()


@shared_task
def finalize_groupbuys():
    return _finalize_groupbuys_core()


@shared_task
def send_low_stock_notification(alert_id: int):
    # 占位实现：此处可集成邮件/短信/管理端推送
    # 为了演示，当前不做任何阻塞操作
    return f"alert {alert_id} notified"


