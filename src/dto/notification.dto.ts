export class NotificationDto {
  readonly notification_id: number;
  readonly user_id: number;
  readonly title: string;
  readonly message: string;
  readonly is_read: boolean;
  readonly created_at: Date;
}
