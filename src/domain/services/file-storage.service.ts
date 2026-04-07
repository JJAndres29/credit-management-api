export interface UploadResult {
  url: string;
  publicId: string;
}

export interface FileStorageService {
  uploadBuffer(buffer: Buffer, mimetype: string, folder?: string): Promise<UploadResult>;
  deleteFile(publicId: string): Promise<boolean>;
}
