import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ElasticSearchModuleModule } from './elastic-search-module/elastic-search-module.module';
@Module({
  imports: [ElasticSearchModuleModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
