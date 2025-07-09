import { Test, TestingModule } from '@nestjs/testing';
import { ElasticSearchModuleService } from './elastic-search-module.service';

describe('ElasticSearchModuleService', () => {
  let service: ElasticSearchModuleService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ElasticSearchModuleService],
    }).compile();

    service = module.get<ElasticSearchModuleService>(
      ElasticSearchModuleService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
