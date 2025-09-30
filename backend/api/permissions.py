from rest_framework.permissions import BasePermission


class IsAdminRole(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and getattr(user, 'role', None) == 'admin')


class IsLeaderRole(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        # 检查用户是否是已批准的团长
        return bool(
            user and 
            user.is_authenticated and 
            getattr(user, 'role', None) == 'leader' and
            getattr(user, 'leader_status', None) == 'approved'
        )


class IsUserRole(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and getattr(user, 'role', None) == 'user')


