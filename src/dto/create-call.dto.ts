import { IsNotEmpty, IsNumber } from 'class-validator';

export class CreateCallDto {
  @IsNotEmpty({ message: 'hostId không được để trống' })
  @IsNumber()
  hostId: number;

  @IsNotEmpty({ message: 'guestId không được để trống' })
  @IsNumber()
  guestId: number;
}
