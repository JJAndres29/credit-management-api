import multer, { FileFilterCallback } from 'multer';
import { Request } from 'express';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_FILES = 5;

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
): void => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Formato no permitido. Solo se aceptan imágenes JPG, PNG o WebP'));
  }
};

export const uploadImages = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: MAX_FILES,
  },
  fileFilter,
}).array('images', MAX_FILES);
