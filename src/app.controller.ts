import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { ElasticSearchModuleService } from './elastic-search-module/elastic-search-module.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly esService: ElasticSearchModuleService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
  @Get('/test-elasticsearch')
  test() {
    return this.esService.search('my-index', {
      match_all: {},
    });
  }
}
