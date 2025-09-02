import { Test, TestingModule } from '@nestjs/testing';
import { GenerateCvController } from './generate-cv.controller';
import { GenerateCvService } from './generate-cv.service';

describe('GenerateCvController', () => {
  let controller: GenerateCvController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GenerateCvController],
      providers: [GenerateCvService],
    }).compile();

    controller = module.get<GenerateCvController>(GenerateCvController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
