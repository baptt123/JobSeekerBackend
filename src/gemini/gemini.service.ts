import { Inject, Injectable } from '@nestjs/common';
import * as nestjsGenai from 'nestjs-genai';

@Injectable()
export class GeminiService {
  constructor(
    @Inject(nestjsGenai.GENAI_MODELS)
    private readonly models: nestjsGenai.Models,
  ) {}
  async generateText(prompt: string): Promise<string | undefined> {
    const response = await this.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text;
  }
}
