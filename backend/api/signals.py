from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Alert
from .tasks import send_low_stock_notification


@receiver(post_save, sender=Alert)
def on_alert_created(sender, instance: Alert, created: bool, **kwargs):
    if created:
        send_low_stock_notification.delay(instance.id)


