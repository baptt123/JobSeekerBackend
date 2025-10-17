import { Module } from '@nestjs/common';
import { FirebaseModuleService } from './firebase-module.service';
import { FirebaseModuleController } from './firebase-module.controller';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  controllers: [FirebaseModuleController],
  providers: [FirebaseModuleService],
  exports: [FirebaseModuleService],
})
export class FirebaseModuleModule {}
