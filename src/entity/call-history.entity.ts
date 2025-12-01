import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger'; // <--- IMPORT

@Entity('call_histories')
export class CallHistoryEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @ApiProperty()
  host_id: number;

  @Column()
  @ApiProperty()
  guest_id: number;

  @Column({ unique: true })
  @ApiProperty()
  room_id: string;

  @Column()
  @ApiProperty()
  jitsi_url: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  @ApiProperty()
  start_time: Date;

  @Column({ type: 'timestamp', nullable: true })
  @ApiProperty({ required: false })
  end_time: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
