import { Test, TestingModule } from '@nestjs/testing';
import { FirebaseModuleService } from './firebase-module.service';

describe('FirebaseModuleService', () => {
  let service: FirebaseModuleService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FirebaseModuleService],
    }).compile();

    service = module.get<FirebaseModuleService>(FirebaseModuleService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
