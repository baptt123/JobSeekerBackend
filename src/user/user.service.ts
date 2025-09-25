import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../entity/user.entity';
import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { RegisterDto } from '../dto/register.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import * as bcrypt from 'bcrypt';
import { MailerService } from '@nestjs-modules/mailer';
import crypto from 'crypto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserEntity)
    public readonly userRepo: Repository<UserEntity>,
    private readonly mailerService: MailerService,
  ) {}
  async create(dto: RegisterDto): Promise<UserEntity> {
    const existingUser = await this.userRepo.findOne({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new BadRequestException(`Email đã được ${dto.email} sử dụng`);
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = this.userRepo.create({
      email: dto.email,
      full_name: dto.full_name,
      password_hash: passwordHash,
      role_id: 2, // mặc định role user
    });

    return this.userRepo.save(user);
  }
  async updatePassword(userId: number, dto: ChangePasswordDto) {
    const user = await this.userRepo.findOne({ where: { user_id: userId } });
    if (!user) throw new UnauthorizedException('User không tìm thấy');

    const validOld = await bcrypt.compare(dto.oldPassword, user.password_hash);
    if (!validOld) throw new BadRequestException('Mật khẩu cũ không đúng');

    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException(
        'Mật khẩu xác nhận và mật khẩu cũ không khớp',
      );
    }

    user.password_hash = await bcrypt.hash(dto.newPassword, 10);
    await this.userRepo.save(user);

    return { message: 'Cập nhật mật khẩu thành công' };
  }
  async forgotPassword(email: ForgotPasswordDto) {
    const user = await this.userRepo.findOne({ where: { email: email } });
    if (!user) throw new BadRequestException('Email không tồn tại ');

    // Tạo mật khẩu mới ngẫu nhiên
    const newPass = crypto.randomBytes(4).toString('hex'); // ví dụ: "a3f9c8d2"

    // Hash và update vào DB
    const newHash = await bcrypt.hash(newPass, 10);
    user.password_hash = newHash;
    await this.userRepo.save(user);

    // Gửi email mật khẩu mới
    await this.mailerService.sendMail({
      to: user.email,
      subject: 'Gửi mật khẩu mới',
      text: `Xin chào ${user.full_name},\n\nMật khẩu mới của bạn: ${newPass}\n\nLàm ơn hãy quay lại trang đăng nhập để đăng nhập vào hệ thống.`,
    });

    return {
      message:
        'Mật khẩu mới đã được gửi đến email của bạn! Vui lòng kiểm tra trong email của bạn',
    };
  }
}
