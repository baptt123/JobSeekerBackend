// guards/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorator/role-admin-recruiter.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. Lấy danh sách role yêu cầu từ Controller/Handler
    const requiredRoles = this.reflector.getAllAndOverride<number[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Nếu route không yêu cầu role nào cụ thể -> cho qua
    if (!requiredRoles) {
      return true;
    }

    // 2. Lấy user từ request (đã được JwtWebStrategy return ở bước trước)
    const { user } = context.switchToHttp().getRequest();

    // 3. Kiểm tra user có roleId hợp lệ không
    if (!user || !user.roleId) {
      throw new ForbiddenException('Bạn không có quyền truy cập (Unknown Role)');
    }

    // 4. Kiểm tra roleId của user có nằm trong danh sách cho phép không
    const hasRole = requiredRoles.includes(user.roleId);

    if (!hasRole) {
      throw new ForbiddenException('Bạn không có quyền Admin để truy cập trang này');
    }

    return true;
  }
}