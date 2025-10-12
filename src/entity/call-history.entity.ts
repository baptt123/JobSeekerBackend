import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('call_histories')
export class CallHistoryEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  host_id: number;

  @Column()
  guest_id: number;

  @Column({ unique: true })
  room_id: string;

  @Column()
  jitsi_url: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  start_time: Date;

  @Column({ type: 'timestamp', nullable: true })
  end_time: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
