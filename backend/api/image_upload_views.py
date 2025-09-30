from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django.conf import settings
import os
import uuid
from PIL import Image
import io


class ImageUploadView(APIView):
    """通用图片上传接口"""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    
    def post(self, request):
        try:
            uploaded_file = request.FILES.get('image')
            if not uploaded_file:
                return Response({'error': '请选择图片文件'}, status=400)
            
            # 验证文件类型
            allowed_types = ['image/jpeg', 'image/png', 'image/webp']
            if uploaded_file.content_type not in allowed_types:
                return Response({'error': '只支持 JPG、PNG、WebP 格式的图片'}, status=400)
            
            # 验证文件大小 (5MB)
            max_size = 5 * 1024 * 1024
            if uploaded_file.size > max_size:
                return Response({'error': '图片大小不能超过 5MB'}, status=400)
            
            # 生成唯一文件名
            file_extension = os.path.splitext(uploaded_file.name)[1]
            unique_filename = f"{uuid.uuid4()}{file_extension}"
            
            # 处理图片（压缩和调整尺寸）
            processed_image = self.process_image(uploaded_file)
            
            # 保存文件
            file_path = f"uploads/images/{unique_filename}"
            saved_path = default_storage.save(file_path, processed_image)
            
            # 返回文件URL
            file_url = default_storage.url(saved_path)
            
            return Response({
                'success': True,
                'url': file_url,
                'filename': unique_filename
            })
        except Exception as e:
            return Response({'error': f'上传失败: {str(e)}'}, status=500)
    
    def process_image(self, uploaded_file):
        """处理图片：压缩和调整尺寸"""
        try:
            # 打开图片
            image = Image.open(uploaded_file)
            
            # 转换为RGB模式（如果是RGBA等）
            if image.mode in ('RGBA', 'LA', 'P'):
                background = Image.new('RGB', image.size, (255, 255, 255))
                if image.mode == 'P':
                    image = image.convert('RGBA')
                background.paste(image, mask=image.split()[-1] if image.mode == 'RGBA' else None)
                image = background
            
            # 调整图片尺寸（最大800x800）
            max_size = (800, 800)
            image.thumbnail(max_size, Image.Resampling.LANCZOS)
            
            # 保存到字节流
            output = io.BytesIO()
            image.save(output, format='JPEG', quality=85, optimize=True)
            output.seek(0)
            
            return ContentFile(output.read())
        except Exception as e:
            # 如果处理失败，返回原文件
            uploaded_file.seek(0)
            return uploaded_file


class ProductImageUploadView(APIView):
    """商品图片上传"""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    
    def post(self, request, product_id):
        try:
            from .models import Product
            
            # 检查商品是否存在和权限
            try:
                product = Product.objects.get(id=product_id)
            except Product.DoesNotExist:
                return Response({'error': '商品不存在'}, status=404)
            
            # 检查权限（只有管理员或商品创建者可以上传）
            if not (request.user.role == 'admin' or product.created_by == request.user):
                return Response({'error': '没有权限上传此商品的图片'}, status=403)
            
            uploaded_file = request.FILES.get('image')
            if not uploaded_file:
                return Response({'error': '请选择图片文件'}, status=400)
            
            # 使用通用图片上传逻辑
            image_upload = ImageUploadView()
            result = image_upload.post(request)
            
            if result.status_code == 200:
                # 更新商品图片字段
                result_data = result.data
                product.image = result_data['url']
                product.save()
                
                return Response({
                    'success': True,
                    'message': '商品图片上传成功',
                    'url': result_data['url']
                })
            else:
                return result
                
        except Exception as e:
            return Response({'error': f'上传失败: {str(e)}'}, status=500)
