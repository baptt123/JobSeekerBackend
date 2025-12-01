import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger'; // <--- IMPORT
import { JobEntity } from './job.entity';
import { SkillEntity } from './skill.entity';

@Entity('job_skills')
export class JobSkillEntity {
  @PrimaryColumn()
  job_id: number;

  @PrimaryColumn()
  skill_id: number;

  @Column('boolean', { default: true })
  @ApiProperty()
  is_required: boolean;

  @ManyToOne(() => JobEntity, (job) => job.jobSkills, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'job_id' })
  @ApiProperty({ type: () => JobEntity }) // <--- THÊM
  job: JobEntity;

  @ManyToOne(() => SkillEntity, (skill) => skill.jobSkills, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'skill_id' })
  @ApiProperty({ type: () => SkillEntity }) // <--- THÊM
  skill: SkillEntity;
}
