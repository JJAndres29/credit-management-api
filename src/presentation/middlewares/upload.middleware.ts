import multer, { FileFilterCallback } from 'multer';
import { NextFunction, Request, Response } from 'express';

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

export async function validateImageMagicBytes(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) {
    next();
    return;
  }

  const { fromBuffer } = await import('file-type');

  for (const file of files) {
    const detected = await fromBuffer(file.buffer);
    if (!detected || !ALLOWED_MIME_TYPES.includes(detected.mime)) {
      res.status(400).json({ error: 'El contenido del archivo no corresponde a una imagen JPG, PNG o WebP válida' });
      return;
    }
    if (detected.mime !== file.mimetype) {
      res.status(400).json({ error: 'El tipo MIME declarado no coincide con el contenido real de la imagen' });
      return;
    }
  }

  next();
}
