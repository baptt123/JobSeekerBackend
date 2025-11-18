// or-auth.guard.ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Giả sử strategy của bạn đặt tên là 'firebase' và 'jwt'
// Nếu một trong hai strategy thành công, request sẽ được thông qua.
@Injectable()
export class OrAuthGuard extends AuthGuard(['firebase-auth', 'jwt']) {}
