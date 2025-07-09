import { Module } from '@nestjs/common';
import { ElasticsearchModule } from '@nestjs/elasticsearch';
import { ElasticSearchModuleService } from './elastic-search-module.service';

@Module({
  imports: [
    ElasticsearchModule.register({
      node: 'http://localhost:9200',
    }),
  ],
  providers: [ElasticSearchModuleService],
  exports: [ElasticSearchModuleService],
})
export class ElasticSearchModuleModule {}
