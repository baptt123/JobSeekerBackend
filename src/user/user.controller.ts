import {
  Body,
  Controller,
  Get,
  HttpCode,
  Put,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  ValidationPipe,
} from '@nestjs/common';
import { UserService } from './user.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { UpdateUserDto } from '../dto/update-user.dto';
import { JwtAuthGuard } from '../guard/jwt-auth.guard';
import { Not } from 'typeorm';
import { FirebaseModuleService } from '../firebase-module/firebase-module.service';
import { OrAuthGuard } from '../guard/or-auth.guard';
import { Roles } from '../decorator/role.decorator';

@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly firebaseService: FirebaseModuleService,
  ) {}

  @Put('update-user')
  @UseGuards(OrAuthGuard)
  @Roles('CANDIDATE', 'ADMIN', 'RECRUITER')
  @UseInterceptors(FileInterceptor('avatar')) // Tên field trong Postman/Flutter phải là 'avatar'
  async updateUser(
    @Req() req: any,
    // Thêm ValidationPipe để validate DTO chặt chẽ
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: UpdateUserDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment
    const userId = req.user.userId;

    const updatedUser = await this.userService.updateUser(userId, dto, file);

    return {
      message: 'Cập nhật thông tin user thành công',
      data: updatedUser,
    };
  }

  // ✅ API MỚI CHO DANH SÁCH HỘI THOẠI
  @UseGuards(JwtAuthGuard) // Yêu cầu phải đăng nhập
  @Get('conversations')
  @UseGuards(OrAuthGuard)
  @Roles('CANDIDATE', 'ADMIN', 'RECRUITER')
  async getConversationList(@Req() req) {
    // req.user được gán từ JwtStrategy (payload)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
    const currentUserId = req.user.userId;

    // Lấy tất cả user TRỪ chính mình
    return await this.userService.userRepo.find({
      where: {
        user_id: Not(currentUserId), // Loại bỏ ID của chính mình
      },
      select: {
        user_id: true,
        full_name: true,
        email: true,
        avatar_url: true,
      },
    });
  }
  @Get('profile')
  @UseGuards(OrAuthGuard)
  @Roles('CANDIDATE', 'ADMIN', 'RECRUITER')
  @HttpCode(200)
  async getProfile(@Req() req: any) {
    // Tạm thời hardcode user_id = 1 theo yêu cầu test
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
    const userId = req.user.userId;
    // const userId = 1;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const user = await this.userService.getUserProfile(userId);
    return { message: 'Lấy thông tin user thành công', data: user };
  }
  @Put('update-fcm-token')
  @UseGuards(OrAuthGuard)
  @Roles('CANDIDATE', 'RECRUITER')
  async updateFcmToken(@Req() req: any, @Body('fcm_token') token: string) {
    const userId = req.user.userId;
    await this.userService.saveFcmToken(userId, token);
    return { message: 'Cập nhật token thành công' };
  }
}
