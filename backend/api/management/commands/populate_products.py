"""
Django Management命令：填充示例商品数据
使用方法：python manage.py populate_products
"""

from django.core.management.base import BaseCommand
from api.models import Product, Category
from decimal import Decimal


"""
Django Management命令：填充示例商品数据
使用方法：python manage.py populate_products
"""

from django.core.management.base import BaseCommand
from api.models import Product, Category
from decimal import Decimal
import random

class Command(BaseCommand):
    help = '创建示例商品数据'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('\n开始创建示例商品数据...\n'))
        
        # 1. 确保分类存在
        categories_map = {}
        initial_categories = [
            {'name': '生鲜果蔬', 'code': 'fresh'},
            {'name': '肉禽蛋类', 'code': 'meat'},
            {'name': '日用百货', 'code': 'daily'},
        ]
        
        for cat_data in initial_categories:
            category, _ = Category.objects.get_or_create(name=cat_data['name'])
            categories_map[cat_data['code']] = category

        # 2. 定义基础数据池（不含形容词）
        # 格式：(基础名称, 价格范围min, 价格范围max, 分类code)
        base_products = [
            # 生鲜果蔬
            ('红富士苹果', 5, 15, 'fresh'),
            ('赣南脐橙', 8, 20, 'fresh'),
            ('巨峰葡萄', 15, 30, 'fresh'),
            ('香蕉', 3, 8, 'fresh'),
            ('西红柿', 4, 10, 'fresh'),
            ('黄瓜', 3, 8, 'fresh'),
            ('菠菜', 4, 10, 'fresh'),
            ('土豆', 2, 6, 'fresh'),
            ('大白菜', 2, 5, 'fresh'),
            ('胡萝卜', 3, 7, 'fresh'),
            ('茄子', 4, 9, 'fresh'),
            ('西兰花', 6, 12, 'fresh'),
            ('草莓', 20, 50, 'fresh'),
            ('蓝莓', 15, 40, 'fresh'),
            ('哈密瓜', 10, 25, 'fresh'),
            ('西瓜', 10, 30, 'fresh'),
            ('火龙果', 8, 18, 'fresh'),
            ('猕猴桃', 10, 25, 'fresh'),
            ('柠檬', 5, 15, 'fresh'),
            ('生姜', 8, 15, 'fresh'),

            # 肉禽蛋类
            ('黑猪五花肉', 30, 50, 'meat'),
            ('精瘦肉', 25, 40, 'meat'),
            ('排骨', 35, 60, 'meat'),
            ('猪蹄', 30, 50, 'meat'),
            ('牛肉', 50, 90, 'meat'),
            ('牛腩', 45, 80, 'meat'),
            ('牛腱子', 60, 100, 'meat'),
            ('羊排', 50, 90, 'meat'),
            ('羊肉卷', 40, 70, 'meat'),
            ('鸡翅中', 25, 40, 'meat'),
            ('琵琶腿', 15, 25, 'meat'),
            ('整鸡', 30, 60, 'meat'),
            ('鸭脖', 20, 35, 'meat'),
            ('土鸡蛋', 15, 30, 'meat'),
            ('鸭蛋', 18, 35, 'meat'),
            ('鹌鹑蛋', 12, 25, 'meat'),
            ('乌鸡', 40, 70, 'meat'),
            ('五花肥牛', 35, 60, 'meat'),

            # 日用百货
            ('抽纸', 10, 30, 'daily'),
            ('卷纸', 15, 40, 'daily'),
            ('洗衣液', 20, 60, 'daily'),
            ('洗洁精', 10, 25, 'daily'),
            ('洗手液', 10, 25, 'daily'),
            ('洗发水', 30, 80, 'daily'),
            ('沐浴露', 25, 70, 'daily'),
            ('牙膏', 10, 35, 'daily'),
            ('牙刷', 5, 20, 'daily'),
            ('毛巾', 10, 30, 'daily'),
            ('浴巾', 30, 80, 'daily'),
            ('垃圾袋', 8, 20, 'daily'),
            ('保鲜膜', 5, 15, 'daily'),
            ('一次性手套', 10, 25, 'daily'),
            ('衣架', 15, 40, 'daily'),
            ('收纳箱', 30, 100, 'daily'),
        ]

        # 规格/单位后缀（用于增加多样性）
        specs = [
            '500g', '1kg', '2kg', '2.5kg', '5kg', 
            '一盒', '一箱', '一提', '一袋', '由家装', 
            '家庭装', '实惠装', '量贩装', '大份量', 
            '精品装', '简装', '单个', '双只装', '三只装',
            '100g', '200g', '300g', '10枚', '30枚',
            'S号', 'M号', 'L号', 'XL号',
            '原味', '香辣', '清新', '无糖'
        ]

        # 3. 定义图片池
        image_pool = [
            'products/08f90000021fd4b2194710210bb8d25d.JPG',
            'products/2facd93c87cbadbc0c9adac5ffef97e0.JPG',
            'products/2facd93c87cbadbc0c9adac5ffef97e0_AhOZaCM.JPG',
            'products/2facd93c87cbadbc0c9adac5ffef97e0_h6jpXo5.JPG',
            'products/2facd93c87cbadbc0c9adac5ffef97e0_z1xDTKC.JPG',
            'products/36b1446be1047babd555eceb39423b94.JPG',
            'products/3bda5ca92ee976dfdb14ae65f033840c.JPG',
            'products/678ec51105cd9f865b5765125b481086.JPG',
        ]

        generated_count = 0
        target_count = 500
        
        # 4. 清除旧数据（按依赖顺序删除）
        from api.models import GroupBuy, OrderItem, Review, Alert
        
        self.stdout.write("正在清除旧数据...")
        
        # 删除关联数据
        Alert.objects.all().delete()
        self.stdout.write("- 已清除 Alerts")
        
        Review.objects.all().delete()
        self.stdout.write("- 已清除 Reviews")
        
        OrderItem.objects.all().delete()
        self.stdout.write("- 已清除 OrderItems")
        
        GroupBuy.objects.all().delete()
        self.stdout.write("- 已清除 GroupBuys")
        
        # 最后删除商品
        Product.objects.all().delete()
        self.stdout.write("旧商品数据已清除。")
        
        existing_names = set()

        self.stdout.write(f"正在生成{target_count}个商品数据（带随机图片）...")

        while generated_count < target_count:
            # 随机选择一个基础商品
            base_name, min_price, max_price, cat_code = random.choice(base_products)
            
            # 随机选择一个规格后缀
            spec = random.choice(specs)
            
            # 组合名称
            full_name = f"{base_name} {spec}"
            
            # 检查重复
            if full_name in existing_names:
                continue
            
            existing_names.add(full_name)
            
            # 生成价格（保留2位小数）
            price = round(random.uniform(min_price, max_price), 2)
            
            # 生成库存
            stock = random.randint(10, 500)
            
            # 随机选择一张图片
            image_path = random.choice(image_pool)
            
            # 创建商品
            Product.objects.create(
                name=full_name,
                description=f"{base_name} {spec}，品质保证。",
                price=Decimal(str(price)),
                stock_quantity=stock,
                category=categories_map[cat_code],
                image=image_path
            )
            
            generated_count += 1
            if generated_count % 50 == 0:
                self.stdout.write(f"已生成 {generated_count}/{target_count}")

        self.stdout.write(self.style.SUCCESS(f"\n成功生成 {generated_count} 个新商品！"))
        self.stdout.write(self.style.SUCCESS(f"当前总商品数: {Product.objects.count()}"))
