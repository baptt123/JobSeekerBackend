import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger'; // <--- IMPORT
import { JobSkillEntity } from './job-skill.entity';

@Entity('skills')
export class SkillEntity {
  @PrimaryGeneratedColumn()
  skill_id: number;

  @Column({ length: 100, unique: true })
  @ApiProperty()
  skill_name: string;

  @OneToMany(() => JobSkillEntity, (jobSkill) => jobSkill.skill)
  @ApiProperty({ type: () => JobSkillEntity, isArray: true }) // <--- FIX CIRCULAR
  jobSkills: JobSkillEntity[];
}