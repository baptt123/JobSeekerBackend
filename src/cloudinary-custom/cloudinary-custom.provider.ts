import { v2 as cloudinary } from 'cloudinary';
import { ConfigService } from '@nestjs/config';
export const CloudinaryProvider = {
  provide: 'Cloudinary',
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
    return cloudinary.config({
      cloud_name: configService.get<string>('CLOUDINARY_NAME'),
      api_key: configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: configService.get<string>('CLOUDINARY_API_SECRET'),
    });
  },
};
