import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { JobSkillEntity } from './job-skill.entity';

@Entity('Skills')
export class SkillEntity {
  @PrimaryGeneratedColumn()
  skill_id: number;

  @Column({ length: 100, unique: true })
  skill_name: string;

  @OneToMany(() => JobSkillEntity, (jobSkill) => jobSkill.skill)
  jobSkills: JobSkillEntity[];
}
