import { v2 as cloudinary } from 'cloudinary';
import { envs } from '../../config/envs';
import { FileStorageService, UploadResult } from '../../domain/services/file-storage.service';

export class CloudinaryAdapter implements FileStorageService {
  constructor() {
    cloudinary.config({
      cloud_name: envs.cloudinary.cloudName,
      api_key: envs.cloudinary.apiKey,
      api_secret: envs.cloudinary.apiSecret,
    });
  }

  async uploadBuffer(buffer: Buffer, mimetype: string, folder = 'products'): Promise<UploadResult> {
    const base64 = buffer.toString('base64');
    const dataUri = `data:${mimetype};base64,${base64}`;

    const result = await cloudinary.uploader.upload(dataUri, {
      folder,
      resource_type: 'image',
    });

    return {
      url: result.secure_url,
      publicId: result.public_id,
    };
  }

  async deleteFile(publicId: string): Promise<boolean> {
    const result = await cloudinary.uploader.destroy(publicId);
    return result.result === 'ok';
  }
}
