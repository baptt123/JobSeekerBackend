import { Test, TestingModule } from '@nestjs/testing';
import { LivekitCustomService } from './livekit-custom.service';

describe('LivekitCustomService', () => {
  let service: LivekitCustomService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LivekitCustomService],
    }).compile();

    service = module.get<LivekitCustomService>(LivekitCustomService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
