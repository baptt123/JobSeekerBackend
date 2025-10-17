import { Controller } from '@nestjs/common';
import { FirebaseModuleService } from './firebase-module.service';

@Controller('firebase-module')
export class FirebaseModuleController {
  constructor(private readonly firebaseModuleService: FirebaseModuleService) {}
}
