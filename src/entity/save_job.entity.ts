import {
  Entity,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger'; // <--- IMPORT
import { UserEntity } from './user.entity';
import { JobEntity } from './job.entity';

@Entity('saved_jobs')
export class SavedJobEntity {
  @PrimaryColumn()
  user_id: number;

  @PrimaryColumn()
  job_id: number;

  @CreateDateColumn()
  saved_at: Date;

  @ManyToOne(() => UserEntity, (user) => user.savedJobs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  @ApiProperty({ type: () => UserEntity }) // <--- FIX CIRCULAR
  user: UserEntity;

  @ManyToOne(() => JobEntity, (job) => job.savedJobs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'job_id' })
  @ApiProperty({ type: () => JobEntity }) // <--- FIX CIRCULAR
  job: JobEntity;

  @DeleteDateColumn()
  @ApiProperty({ required: false })
  deleted_at: Date | null;
}