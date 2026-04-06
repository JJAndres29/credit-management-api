export interface FileStorageService {
  uploadFile(filePath: string, folder?: string): Promise<string>;
  deleteFile(publicId: string): Promise<boolean>;
}
