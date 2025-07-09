import { Test, TestingModule } from '@nestjs/testing';
import { ElasticSearchModuleController } from './elastic-search-module.controller';
import { ElasticSearchModuleService } from './elastic-search-module.service';

describe('ElasticSearchModuleController', () => {
  let controller: ElasticSearchModuleController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ElasticSearchModuleController],
      providers: [ElasticSearchModuleService],
    }).compile();

    controller = module.get<ElasticSearchModuleController>(
      ElasticSearchModuleController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
