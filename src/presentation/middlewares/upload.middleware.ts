import multer from 'multer';
import { NextFunction, Request, Response } from 'express';
import { CustomError } from '../../domain/errors';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_FILES = 5;

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
): void => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      CustomError.badRequest(
        'Formato no permitido. Solo se aceptan imágenes JPG, PNG o WebP',
      ),
    );
  }
};

const uploadFields = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: MAX_FILES,
  },
  fileFilter,
}).fields([
  { name: 'images', maxCount: MAX_FILES },
  { name: 'assets', maxCount: MAX_FILES },
]);

type FilesBag = Record<string, Express.Multer.File[]>;

/**
 * Multipart: acepta archivos en el campo `images` y/o `assets` (máx. 5 en total).
 * Normaliza a `req.files` como arreglo para los handlers y `validateImageMagicBytes`.
 */
export function uploadImages(req: Request, res: Response, next: NextFunction): void {
  uploadFields(req, res, (err: unknown) => {
    if (err) {
      next(err);
      return;
    }
    const bag = req.files as FilesBag | Express.Multer.File[] | undefined;
    let merged: Express.Multer.File[];
    if (Array.isArray(bag)) {
      merged = bag;
    } else if (bag && typeof bag === 'object') {
      merged = [...(bag.images ?? []), ...(bag.assets ?? [])];
      if (merged.length > MAX_FILES) {
        next(CustomError.badRequest(`Máximo ${MAX_FILES} archivos por solicitud`));
        return;
      }
    } else {
      merged = [];
    }
    Object.assign(req, { files: merged });
    next();
  });
}

export async function validateImageMagicBytes(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
      next();
      return;
    }

    const { fromBuffer } = await import('file-type');

    for (const file of files) {
      const detected = await fromBuffer(file.buffer);
      if (!detected || !ALLOWED_MIME_TYPES.includes(detected.mime)) {
        next(
          CustomError.badRequest(
            'El contenido del archivo no corresponde a una imagen JPG, PNG o WebP válida',
          ),
        );
        return;
      }
      if (detected.mime !== file.mimetype) {
        next(
          CustomError.badRequest(
            'El tipo MIME declarado no coincide con el contenido real de la imagen',
          ),
        );
        return;
      }
    }

    next();
  } catch {
    next(
      CustomError.badRequest(
        'No se pudo validar el contenido de la imagen. Intente con otro archivo.',
      ),
    );
  }
}
