import {
  Body,
  Controller,
  Get,
  Put,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { UserService } from './user.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { UpdateUserDto } from '../dto/update-user.dto';
import { JwtAuthGuard } from '../guard/jwt-auth.guard';
import { Roles } from '../decorator/role.decorator';
import { RolesGuard } from '../guard/role-auth.guard';
import { Not } from 'typeorm';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Put('update-user')
  @UseInterceptors(FileInterceptor('avatar'))
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CANDIDATE', 'ADMIN', 'RECRUITER')
  async updateUser(
    @Req() req: any,
    @Body() dto: UpdateUserDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const updatedUser = await this.userService.updateUser(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-argument
      req.user.userId,
      dto,
      file,
    );
    return { message: 'Cập nhật thông tin user thành công', data: updatedUser };
  }

  // ✅ API MỚI CHO DANH SÁCH HỘI THOẠI
  @UseGuards(JwtAuthGuard) // Yêu cầu phải đăng nhập
  @Get('conversations')
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
}
