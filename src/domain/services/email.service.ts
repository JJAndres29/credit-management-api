export interface EmailAttachment {
  filename: string;
  /** Ruta en disco — para archivos estáticos */
  path?: string;
  /** Contenido en memoria — para PDFs generados on-the-fly sin tocar disco */
  content?: Buffer;
  contentType?: string;
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  htmlBody: string;
  attachments?: EmailAttachment[];
}

export interface EmailService {
  sendEmail(options: SendEmailOptions): Promise<boolean>;
}
