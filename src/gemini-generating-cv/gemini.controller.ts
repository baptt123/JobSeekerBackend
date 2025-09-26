import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { GeminiService } from './gemini.service';
import { Roles } from '../decorator/role.decorator';
import { RolesGuard } from '../guard/role-auth.guard';

@Controller('gemini')
export class GeminiController {
  constructor(private readonly geminiService: GeminiService) {}
  @Roles('USER')
  @UseGuards(RolesGuard)
  @Get()
  public async getHello(@Query() prompt: string): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    return this.geminiService.generateText(prompt);
  }
}
