import { Injectable } from '@nestjs/common';
import { ElasticsearchService as NestElasticsearchService } from '@nestjs/elasticsearch';

@Injectable()
export class ElasticSearchModuleService {
  constructor(
    private readonly elasticsearchService: NestElasticsearchService,
  ) {}

  async indexDocument(index: string, id: string, body: any) {
    return this.elasticsearchService.index({
      index,
      id,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      document: body,
    });
  }

  async search(index: string, query: any) {
    return this.elasticsearchService.search({
      index,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      query,
    });
  }

  async deleteDocument(index: string, id: string) {
    return this.elasticsearchService.delete({
      index,
      id,
    });
  }
}
