import {
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CloudinaryCustomService } from './cloudinary-custom.service';
import { RolesGuard } from '../guard/role-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { Roles } from '../decorator/role.decorator';

@Controller('cloudinary-custom')
export class CloudinaryCustomController {
  constructor(
    private readonly cloudinaryCustomService: CloudinaryCustomService,
  ) {}
  @Post('upload-file')
  @UseGuards(RolesGuard)
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
