import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class WebAuthGuard extends AuthGuard('jwt-web') {
  handleRequest(err, user, info) {
    // Nếu có lỗi hoặc không có user -> Ném lỗi 401 ra ngoài
    if (err || !user) {
      throw err || new UnauthorizedException();
    }
    return user;
  }
}
