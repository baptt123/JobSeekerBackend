import { Test, TestingModule } from '@nestjs/testing';
import { GenerateCvService } from './generate-cv.service';

describe('GenerateCvService', () => {
  let service: GenerateCvService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GenerateCvService],
    }).compile();

    service = module.get<GenerateCvService>(GenerateCvService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
