export interface NotificationService {
  sendWhatsApp(to: string, message: string): Promise<boolean>;
  sendTemplate(to: string, templateName: string, variables: string[], languageCode?: string): Promise<boolean>;
  sendDocument(
    to: string,
    document: Buffer,
    filename: string,
    caption?: string,
    mimeType?: string,
  ): Promise<boolean>;
  sendDocumentTemplate(
    to: string,
    templateName: string,
    document: Buffer,
    filename: string,
    bodyVariables: string[],
    languageCode?: string,
  ): Promise<boolean>;
}
