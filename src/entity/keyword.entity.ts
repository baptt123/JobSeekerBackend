import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { CVKeywordEntity } from './cv-keyword.entity';

@Entity('Keywords')
export class KeywordEntity {
  @PrimaryGeneratedColumn()
  keyword_id: number;

  @Column({ unique: true })
  keyword_name: string;

  @OneToMany(() => CVKeywordEntity, (cvKeyword) => cvKeyword.keyword)
  cvKeywords: CVKeywordEntity[];
}
