import { Controller, Get } from '@nestjs/common';
import { UserService } from './user.service';
import { ProductService } from '../product/product.service';

@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly productService: ProductService,
  ) {}
  @Get('all')
  start(): string {
    return this.userService.getUser();
  }
}
