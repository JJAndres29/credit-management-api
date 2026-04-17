export interface NotificationService {
  sendWhatsApp(to: string, message: string): Promise<boolean>;
  sendTemplate(to: string, templateName: string, variables: string[], languageCode?: string): Promise<boolean>;
}
