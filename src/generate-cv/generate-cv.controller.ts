import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { GenerateCvService } from './generate-cv.service';
import { RolesGuard } from '../guard/role-auth.guard';
import { Roles } from '../decorator/role.decorator';

@Controller('generate-cv')
export class GenerateCvController {
  constructor(private readonly generateCvService: GenerateCvService) {}
  @UseGuards(RolesGuard)
  @Roles('USER', 'ADMIN', 'RECRUITER')
  @Post()
  public async generateCv(@Body() prompt: string): Promise<Buffer> {
    return await this.generateCvService.exportCvPdf(prompt);
  }
}
