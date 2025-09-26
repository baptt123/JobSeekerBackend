import { Test, TestingModule } from '@nestjs/testing';
import { CloudinaryCustomController } from './cloudinary-custom.controller';
import { CloudinaryCustomService } from './cloudinary-custom.service';

describe('CloudinaryCustomController', () => {
  let controller: CloudinaryCustomController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CloudinaryCustomController],
      providers: [CloudinaryCustomService],
    }).compile();

    controller = module.get<CloudinaryCustomController>(
      CloudinaryCustomController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
