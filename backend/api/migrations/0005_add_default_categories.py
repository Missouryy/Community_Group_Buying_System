# Generated migration for adding default categories

from django.db import migrations


def create_default_categories(apps, schema_editor):
    Category = apps.get_model('api', 'Category')
    
    # 创建默认分类
    categories = [
        {'name': '果蔬'},
        {'name': '肉蛋'},
        {'name': '日用'},
    ]
    
    for cat_data in categories:
        Category.objects.get_or_create(name=cat_data['name'])


def remove_default_categories(apps, schema_editor):
    Category = apps.get_model('api', 'Category')
    Category.objects.filter(name__in=['果蔬', '肉蛋', '日用']).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0004_alter_product_created_at_alter_product_updated_at'),
    ]

    operations = [
        migrations.RunPython(create_default_categories, remove_default_categories),
    ]

