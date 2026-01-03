// decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';

// Key để metadata nhận diện
export const ROLES_KEY = 'roles';

// Hàm này nhận vào danh sách các ID được phép (ví dụ: [1, 2])
export const Roles = (...roles: number[]) => SetMetadata(ROLES_KEY, roles);