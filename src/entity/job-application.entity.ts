import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { JobEntity } from './job.entity';
import { UserEntity } from './user.entity';
import { UserCVEntity } from './user-cv.entity';

@Entity('Job_Applications')
export class JobApplicationEntity {
  @PrimaryGeneratedColumn()
  application_id: number;

  @Column()
  job_id: number;

  @ManyToOne(() => JobEntity, (job) => job.applications, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'job_id' })
  job: JobEntity;

  @Column()
  user_id: number;

  @ManyToOne(() => UserEntity, (user) => user.jobApplications, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ nullable: true })
  cv_id: number;

  @ManyToOne(() => UserCVEntity, (cv) => cv, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'cv_id' })
  cv: UserCVEntity;

  @Column('text', { nullable: true })
  cover_letter: string;

  @Column({
    type: 'enum',
    enum: [
      'Applied',
      'Screening',
      'Interview',
      'Offer',
      'Accepted',
      'Rejected',
    ],
    default: 'Applied',
  })
  status:
    | 'Applied'
    | 'Screening'
    | 'Interview'
    | 'Offer'
    | 'Accepted'
    | 'Rejected';

  @CreateDateColumn()
  applied_at: Date;
}
