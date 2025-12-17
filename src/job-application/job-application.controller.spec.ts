import { Test, TestingModule } from '@nestjs/testing';
import { JobApplicationController } from './job-application.controller';
import { JobApplicationsService } from './job-application.service';

describe('JobApplicationController', () => {
  let controller: JobApplicationController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [JobApplicationController],
      providers: [JobApplicationsService],
    }).compile();

    controller = module.get<JobApplicationController>(JobApplicationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
