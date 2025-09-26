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


@shared_task
def send_low_stock_notification(alert_id: int):
    # 占位实现：此处可集成邮件/短信/管理端推送
    # 为了演示，当前不做任何阻塞操作
    return f"alert {alert_id} notified"


