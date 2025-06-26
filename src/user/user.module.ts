import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { ProductModule } from 'src/product/product.module';
import { ProductService } from 'src/product/product.service';

@Module({
  imports: [ProductModule],
  controllers: [UserController],
  providers: [UserService, ProductService],
})
export class UserModule {}
