import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { GenerateCvService } from './generate-cv.service';
import { RolesGuard } from '../guard/role-auth.guard';
import { Roles } from '../decorator/role.decorator';
import { CreateUserCvDto } from '../dto/create-cv.dto';
import { UserCVEntity } from '../entity/user-cv.entity';

@Controller('generate-cv')
export class GenerateCvController {
  constructor(private readonly generateCvService: GenerateCvService) {}

  @UseGuards(RolesGuard)
  @Roles('USER', 'ADMIN', 'RECRUITER')
  @Post()
  public async generateCv(@Body() prompt: string): Promise<Buffer> {
    return await this.generateCvService.exportCvPdf(prompt);
  }

  @UseGuards(RolesGuard)
  @Roles('USER', 'ADMIN', 'RECRUITER')
  @Get()
  public async saveCV(@Body() dto: CreateUserCvDto): Promise<UserCVEntity> {
    return await this.generateCvService.createCVWithKeywords(dto);
  }
}
