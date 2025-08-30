import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { UserEntity } from './user.entity';
import { JobSkillEntity } from './job-skill.entity';
import { JobApplicationEntity } from './job-application.entity';
import { SavedJobEntity } from './save_job.entity';
import { CompanyEntity } from './company.entity';
@Entity('Jobs')
export class JobEntity {
  @PrimaryGeneratedColumn()
  job_id: number;

  @Column()
  company_id: number;

  @ManyToOne(() => CompanyEntity, (company) => company.jobs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'company_id' })
  company: CompanyEntity;

  @Column()
  posted_by: number;

  @ManyToOne(() => UserEntity, (user) => user.postedJobs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'posted_by' })
  postedBy: UserEntity;

  @Column({ length: 255 })
  title: string;

  @Column('text')
  description: string;

  @Column('text', { nullable: true })
  requirements: string;

  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  salary_min: number;

  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  salary_max: number;

  @Column({ length: 255, nullable: true })
  location: string;

  @Column({
    type: 'enum',
    enum: ['Full-time', 'Part-time', 'Internship', 'Contract', 'Freelance'],
    nullable: true,
  })
  job_type: 'Full-time' | 'Part-time' | 'Internship' | 'Contract' | 'Freelance';

  @CreateDateColumn()
  created_at: Date;

  @OneToMany(() => JobSkillEntity, (jobSkill) => jobSkill.job)
  jobSkills: JobSkillEntity[];

  @OneToMany(() => JobApplicationEntity, (application) => application.job)
  applications: JobApplicationEntity[];

  @OneToMany(() => SavedJobEntity, (savedJob) => savedJob.job)
  savedJobs: SavedJobEntity[];
}
