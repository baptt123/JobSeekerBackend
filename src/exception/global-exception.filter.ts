import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // 1. Kiểm tra nếu headers đã gửi rồi thì thôi (Tránh lỗi ERR_HTTP_HEADERS_SENT)
    if (response.headersSent) {
      return;
    }

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: any = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = exception.getResponse();
    }

    // 2. XỬ LÝ ĐẶC BIỆT CHO WEB AUTH
    // Nếu lỗi là 401 (Unauthorized) VÀ đường dẫn bắt đầu bằng /admin hoặc /recruiter
    if (status === HttpStatus.UNAUTHORIZED) {
      const path = request.url;
      // Kiểm tra xem request này có phải từ trình duyệt vào trang quản trị không
      if (
        path.startsWith('/admin') ||
        path.startsWith('/recruiter') ||
        path === '/'
      ) {
        return response.redirect('/web/login');
      }
    }

    // 3. Trả về JSON cho các trường hợp còn lại (API Mobile/Frontend)
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      message,
    });
  }
}
