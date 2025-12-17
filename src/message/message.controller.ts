// src/message/message.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MessageService } from './message.service';
import { CloudinaryCustomService } from '../cloudinary-custom/cloudinary-custom.service'; //
import { WebAuthGuard } from '../guard/web-auth.guard'; // Giả sử bạn có guard này

@Controller('messages')
@UseGuards(WebAuthGuard)
export class MessageController {
  constructor(
    private readonly messageService: MessageService,
    private readonly cloudinaryService: CloudinaryCustomService,
  ) {}

  // 1. Lấy danh sách người đã chat (cho Sidebar)
  @Get('conversations')
  async getConversations(@Req() req: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return await this.messageService.getConversations(req.user.userId);
  }

  // 2. Lấy lịch sử chat với 1 người
  @Get('history/:partnerId')
  async getHistory(@Req() req: any, @Param('partnerId') partnerId: number) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return await this.messageService.getMessages(req.user.userId, +partnerId);
  }

  // 3. Upload File/Ảnh lên Cloudinary (Dùng cho chức năng gửi ảnh)
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('File is required');

    // Upload lên Cloudinary
    const result = await this.cloudinaryService.uploadFile(file);

    // Trả về URL để Client gửi qua Socket
    return {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      url: result.secure_url,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      type: result.resource_type, // 'image' hoặc 'raw' (file)
    };
  }
}