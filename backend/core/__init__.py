try:
	from .celery import app as celery_app  # noqa: F401
except Exception:
	celery_app = None  # 避免在非Celery场景（如migrate）因依赖冲突报错

__all__ = ("celery_app",)

try:
	import pymysql
	pymysql.install_as_MySQLdb()
except Exception:
	pass

