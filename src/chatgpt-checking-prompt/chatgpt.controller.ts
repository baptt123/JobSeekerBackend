import { Controller, Get, UseGuards } from '@nestjs/common';
import { ChatgptService } from './chatgpt.service';
import { ResponseTextConfig } from 'openai/resources/responses/responses';
import { Roles } from '../decorator/role.decorator';
import { RolesGuard } from '../guard/role-auth.guard';

@Controller('chatgpt')
export class ChatgptController {
  constructor(private readonly chatgptService: ChatgptService) {}

  @Get('chatgpt-response')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'USER', 'RECRUITER') // Example roles
  async getResponse(prompt: string): Promise<ResponseTextConfig | undefined> {
    return this.chatgptService.askQuestion(prompt);
  }
}
