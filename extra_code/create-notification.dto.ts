// create-notification.dto.ts
export class CreateNotificationDto {
  readonly user_id: number;
  readonly title: string;
  readonly message: string;
}
