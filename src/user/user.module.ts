import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../entity/user.entity';
import { CloudinaryCustomService } from '../cloudinary-custom/cloudinary-custom.service';
import { CloudinaryCustomModule } from '../cloudinary-custom/cloudinary-custom.module';
@Module({
  imports: [TypeOrmModule.forFeature([UserEntity]), CloudinaryCustomModule],

  controllers: [UserController],
  providers: [UserService, CloudinaryCustomService],
  exports: [UserService],
})
export class UserModule {}
