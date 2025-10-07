import { Module } from '@nestjs/common';
import { GeminiService } from './gemini.service';
import { GeminiController } from './gemini.controller';
import { GenAIModule } from 'nestjs-genai';
@Module({
  imports: [
    GenAIModule.forRoot({
      apiKey: process.env.GEMINI_API_KEY, // .env
    }),
  ],
  controllers: [GeminiController],
  providers: [GeminiService],
  exports: [GeminiService],
})
export class GeminiModule {}
