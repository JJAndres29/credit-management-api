export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  htmlBody: string;
  attachments?: { filename: string; path: string }[];
}

export interface EmailService {
  sendEmail(options: SendEmailOptions): Promise<boolean>;
}
