import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'roles' })
export class Roles {
  @PrimaryGeneratedColumn({ name: 'role_id' })
  role_id: number;

  @Column({
    type: 'enum',
    enum: ['ADMIN', 'CANDIDATE', 'RECRUITER'],
    unique: true,
  })
  role_name: 'ADMIN' | 'CANDIDATE' | 'RECRUITER';
}
