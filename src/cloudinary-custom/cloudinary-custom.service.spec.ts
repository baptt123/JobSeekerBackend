import { Test, TestingModule } from '@nestjs/testing';
import { CloudinaryCustomService } from './cloudinary-custom.service';

describe('CloudinaryCustomService', () => {
  let service: CloudinaryCustomService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CloudinaryCustomService],
    }).compile();

    service = module.get<CloudinaryCustomService>(CloudinaryCustomService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
