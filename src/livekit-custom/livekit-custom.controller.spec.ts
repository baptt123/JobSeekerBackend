import { Test, TestingModule } from '@nestjs/testing';
import { LivekitCustomController } from './livekit-custom.controller';
import { LivekitCustomService } from './livekit-custom.service';

describe('LivekitCustomController', () => {
  let controller: LivekitCustomController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LivekitCustomController],
      providers: [LivekitCustomService],
    }).compile();

    controller = module.get<LivekitCustomController>(LivekitCustomController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
