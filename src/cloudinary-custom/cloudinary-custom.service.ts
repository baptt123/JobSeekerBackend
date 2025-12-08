// src/cloudinary-custom/cloudinary-custom.service.ts

import { Injectable } from '@nestjs/common';
import { UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class CloudinaryCustomService {
  // [MỚI] Public biến cloudinary để service khác dùng được
  get cloudinary() {
    return cloudinary;
  }

  async uploadFile(
    file: Express.Multer.File,
  ): Promise<UploadApiResponse | UploadApiErrorResponse> {
    return new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ resource_type: 'auto' }, (error, result) => {
          // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
          if (error) return reject(error);
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-expect-error
          resolve(result);
        })
        .end(file.buffer);
    });
  }
}
