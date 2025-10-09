import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Put, Req,
  UploadedFile, UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { UserService } from './user.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { UpdateUserDto } from '../dto/update-user.dto';
import { JwtAuthGuard } from '../guard/jwt-auth.guard';
import { Roles } from '../decorator/role.decorator';
import { RolesGuard } from '../guard/role-auth.guard';

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
}
