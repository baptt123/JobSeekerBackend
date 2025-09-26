import { Inject, Injectable } from '@nestjs/common';
import { OpenAI } from 'openai';
import { ResponseTextConfig } from 'openai/resources/responses/responses';

@Injectable()
export class ChatgptService {
  constructor(@Inject('OPENAI_CLIENT') private readonly openai: OpenAI) {}

  async askQuestion(prompt: string): Promise<ResponseTextConfig | undefined> {
    const response = await this.openai.responses.create({
      model: 'gpt-4.1-mini',
      input: prompt,
    });

    return response.text;
  }
}
