export interface NotificationService {
  sendWhatsApp(to: string, message: string): Promise<boolean>;
}
