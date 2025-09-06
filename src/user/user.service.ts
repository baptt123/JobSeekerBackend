import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../entity/user.entity';
import { UpdateUserDto } from '../dto/update-user.dto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

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

  async findOne(email: string): Promise<UserEntity | null> {
    return this.userRepo.findOne({ where: { email } });
  }

  async save(user: UserEntity): Promise<UserEntity> {
    return this.userRepo.save(user);
  }

  async update(user: UserEntity): Promise<UserEntity> {
    return await this.userRepo.save(user);
  }
  async updateUser(id: number, dto: UpdateUserDto): Promise<UserEntity> {
    const user = await this.userRepo.findOne({ where: { user_id: id } });
    if (!user) throw new NotFoundException('User not found');
    Object.assign(user, dto);
    try {
      return await this.userRepo.save(user);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      throw new BadRequestException('Failed to update user');
    }
  }
}
