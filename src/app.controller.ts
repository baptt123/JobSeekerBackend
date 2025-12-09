import { Controller, Get, Redirect } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}
  // Khi người dùng vào trang chủ "/", tự động chuyển sang "/web/login"
  @Get()
  @Redirect('/web/login', 302)
  root() {
    return;
  }
}
