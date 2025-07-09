import { Controller } from '@nestjs/common';
import { ElasticSearchModuleService } from './elastic-search-module.service';

@Controller('elastic-search-module')
export class ElasticSearchModuleController {
  constructor(
    private readonly elasticSearchModuleService: ElasticSearchModuleService,
  ) {}
}
