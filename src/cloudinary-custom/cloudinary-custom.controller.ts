import {
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CloudinaryCustomService } from './cloudinary-custom.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { Roles } from '../decorator/role.decorator';
import { OrAuthGuard } from '../guard/or-auth.guard';

@Controller('cloudinary-custom')
export class CloudinaryCustomController {
  constructor(
    private readonly cloudinaryCustomService: CloudinaryCustomService,
  ) {}
  @Post('upload-file')
  @UseGuards(OrAuthGuard)
  @Roles('ADMIN', 'USER', 'RECRUITER')
  @UseInterceptors(FileInterceptor('file')) // 'file' là key form-data
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    const result = await this.cloudinaryCustomService.uploadFile(file);
    return {
      message: 'Upload thành công',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      url: result.secure_url, // cloudinary trả về
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      public_id: result.public_id,
    };
  }
}
