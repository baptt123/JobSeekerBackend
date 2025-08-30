import {
  Entity,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';
import { JobEntity } from './job.entity';

@Entity('Saved_Jobs')
export class SavedJobEntity {
  @PrimaryColumn()
  user_id: number;

  @PrimaryColumn()
  job_id: number;

  @CreateDateColumn()
  saved_at: Date;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  @ManyToOne(() => UserEntity, (user) => user.savedJobs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @ManyToOne(() => JobEntity, (job) => job.savedJobs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'job_id' })
  job: JobEntity;
}
