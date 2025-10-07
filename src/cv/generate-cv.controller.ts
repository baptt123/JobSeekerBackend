import { GenerateCvService } from './generate-cv.service';
import { RolesGuard } from '../guard/role-auth.guard';
import { Roles } from '../decorator/role.decorator';
import { CreateUserCvDto } from '../dto/create-cv.dto';
import { UserCVEntity } from '../entity/user-cv.entity';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CloudinaryCustomService } from '../cloudinary-custom/cloudinary-custom.service';
import { JwtAuthGuard } from '../guard/jwt-auth.guard';

@Controller('generate-cv')
export class GenerateCvController {
  constructor(
    private readonly generateCvService: GenerateCvService,
    private readonly cloudinaryService: CloudinaryCustomService,
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'RECRUITER', 'USER')
  @Get('gen-cv')
  public async generateCv(@Body() prompt: string): Promise<Buffer> {
    return await this.generateCvService.exportCvPdf(prompt);
  }

  @UseGuards(RolesGuard)
  @Roles('USER', 'ADMIN', 'RECRUITER')
  @Get('save-cv')
  public async saveCV(@Body() dto: CreateUserCvDto): Promise<UserCVEntity> {
    return await this.generateCvService.createCVWithKeywords(dto);
  }

  @Post('upload')
  @UseGuards(RolesGuard)
  @Roles('USER', 'ADMIN', 'RECRUITER')
  @UseInterceptors(FileInterceptor('file'))
  async uploadCV(
    @UploadedFile() file: Express.Multer.File,
    @Body('title') title: string,
    @Body('content') content: string,
    @Body('keywords') keywords: string,
    @Req() req: any,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
    const userId = req.user.userId;

    // Upload lên Cloudinary
    const uploadResult = await this.cloudinaryService.uploadFile(file);
    return this.generateCvService.saveCVAfterUpload(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      userId,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      uploadResult.secure_url,
      title,
      content,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      JSON.parse(keywords),
    );
  }
}
