import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { JobEntity } from './job.entity';
import { SkillEntity } from './skill.entity';

@Entity('Job_Skills')
export class JobSkillEntity {
  @PrimaryColumn()
  job_id: number;

  @PrimaryColumn()
  skill_id: number;

  @Column('boolean', { default: true })
  is_required: boolean;

  @ManyToOne(() => JobEntity, (job) => job.jobSkills, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'job_id' })
  job: JobEntity;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  @ManyToOne(() => SkillEntity, (skill) => skill.jobSkills, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'skill_id' })
  skill: SkillEntity;
}
