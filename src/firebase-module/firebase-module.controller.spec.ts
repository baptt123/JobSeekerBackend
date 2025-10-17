import { Test, TestingModule } from '@nestjs/testing';
import { FirebaseModuleController } from './firebase-module.controller';
import { FirebaseModuleService } from './firebase-module.service';

describe('FirebaseModuleController', () => {
  let controller: FirebaseModuleController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FirebaseModuleController],
      providers: [FirebaseModuleService],
    }).compile();

    controller = module.get<FirebaseModuleController>(FirebaseModuleController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
