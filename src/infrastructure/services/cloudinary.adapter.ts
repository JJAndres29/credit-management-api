import { v2 as cloudinary } from 'cloudinary';
import { envs } from '../../config/envs';
import { CustomError } from '../../domain/errors';
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
    const { cloudName, apiKey, apiSecret } = envs.cloudinary;
    if (!cloudName || !apiKey || !apiSecret) {
      throw CustomError.serviceUnavailable(
        'Almacenamiento de imágenes no disponible: configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET en el servidor',
      );
    }

    const base64 = buffer.toString('base64');
    const dataUri = `data:${mimetype};base64,${base64}`;

    try {
      const result = await cloudinary.uploader.upload(dataUri, {
        folder,
        resource_type: 'image',
      });

      return {
        url: result.secure_url,
        publicId: result.public_id,
      };
    } catch {
      throw CustomError.badRequest(
        'No se pudo subir la imagen a Cloudinary. Revise credenciales y que el archivo sea JPG, PNG o WebP válido.',
      );
    }
  }

  async deleteFile(publicId: string): Promise<boolean> {
    const result = await cloudinary.uploader.destroy(publicId);
    return result.result === 'ok';
  }
}
