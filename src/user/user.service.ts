import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../entity/user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.userRepo.findOne({ where: { email } });
  }

  async create(user: Partial<UserEntity>): Promise<UserEntity> {
    const newUser = this.userRepo.create(user);
    return this.userRepo.save(newUser);
  }

  async findById(id: number): Promise<UserEntity | null> {
    return this.userRepo.findOne({ where: { user_id: id } });
  }
}
