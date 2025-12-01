import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger'; // <--- IMPORT
import { CVKeywordEntity } from './cv-keyword.entity';

@Entity('keywords')
export class KeywordEntity {
  @PrimaryGeneratedColumn()
  keyword_id: number;

  @Column({ unique: true })
  @ApiProperty()
  keyword_name: string;

  @OneToMany(() => CVKeywordEntity, (cvKeyword) => cvKeyword.keyword)
  @ApiProperty({ type: () => CVKeywordEntity, isArray: true }) // <--- THÊM
  cvKeywords: CVKeywordEntity[];
}
