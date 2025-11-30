import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger'; // <--- IMPORT
import { UserEntity } from './user.entity';
import { JobSkillEntity } from './job-skill.entity';
import { JobApplicationEntity } from './job-application.entity';
import { SavedJobEntity } from './save_job.entity';
import { CompanyEntity } from './company.entity';

@Entity('jobs')
export class JobEntity {
  @PrimaryGeneratedColumn()
  job_id: number;

  @Column()
  company_id: number;

  @ManyToOne(() => CompanyEntity, (company) => company.jobs, {
    onDelete: 'CASCADE',
    eager: true,
  })
  @JoinColumn({ name: 'company_id' })
  @ApiProperty({ type: () => CompanyEntity }) // <--- THÊM
  company: CompanyEntity;

  @Column()
  posted_by: number;

  @ManyToOne(() => UserEntity, (user) => user.postedJobs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'posted_by' })
  @ApiProperty({ type: () => UserEntity }) // <--- THÊM
  postedBy: UserEntity;

  @Column({ length: 255 })
  @ApiProperty()
  title: string;

  @Column('text')
  @ApiProperty()
  description: string;

  @Column('text', { nullable: true })
  @ApiProperty({ required: false })
  requirements: string;

  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  @ApiProperty({ required: false })
  salary_min: number;

  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  @ApiProperty({ required: false })
  salary_max: number;

  @Column({ length: 255, nullable: true })
  @ApiProperty({ required: false })
  location: string;

  @Column({
    type: 'enum',
    enum: ['Full-time', 'Part-time', 'Internship', 'Contract', 'Freelance'],
    nullable: true,
  })
  @ApiProperty({ enum: ['Full-time', 'Part-time', 'Internship', 'Contract', 'Freelance'], required: false })
  job_type: 'Full-time' | 'Part-time' | 'Internship' | 'Contract' | 'Freelance';

  @CreateDateColumn()
  created_at: Date;

  @OneToMany(() => JobSkillEntity, (jobSkill) => jobSkill.job)
  @ApiProperty({ type: () => JobSkillEntity, isArray: true }) // <--- THÊM
  jobSkills: JobSkillEntity[];

  @OneToMany(() => JobApplicationEntity, (application) => application.job)
  @ApiProperty({ type: () => JobApplicationEntity, isArray: true }) // <--- THÊM
  applications: JobApplicationEntity[];

  @OneToMany(() => SavedJobEntity, (savedJob) => savedJob.job)
  @ApiProperty({ type: () => SavedJobEntity, isArray: true }) // <--- THÊM
  savedJobs: SavedJobEntity[];

  @Column({ type: 'timestamp', nullable: true })
  @ApiProperty({ required: false })
  deadline: Date;
}