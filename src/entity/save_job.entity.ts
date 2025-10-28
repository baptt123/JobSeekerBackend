import {
  Entity,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  DeleteDateColumn, // 1. Import thêm
} from 'typeorm';
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
  user: UserEntity;

  @ManyToOne(() => JobEntity, (job) => job.savedJobs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'job_id' })
  job: JobEntity;

  @DeleteDateColumn()
  deleted_at: null; // ✅ SỬA LẠI
}
