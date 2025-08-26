import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('Users')
export class UserEntity {
  @PrimaryGeneratedColumn()
  user_id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  password_hash: string;

  @Column()
  full_name: string;

  @Column()
  role_id: number; // 1=ADMIN, 2=CANDIDATE, 3=RECRUITER
}
