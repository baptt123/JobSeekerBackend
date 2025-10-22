import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../entity/user.entity';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { RegisterDto } from '../dto/register.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import * as bcrypt from 'bcrypt';
import { MailerService } from '@nestjs-modules/mailer';
import crypto from 'crypto';
import * as argon2 from 'argon2';
import { UpdateUserDto } from '../dto/update-user.dto';
import { CloudinaryCustomService } from '../cloudinary-custom/cloudinary-custom.service';
@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserEntity)
    public readonly userRepo: Repository<UserEntity>,
    private readonly mailerService: MailerService,
    private readonly cloudinaryService: CloudinaryCustomService,
  ) {}
  async create(dto: RegisterDto): Promise<UserEntity> {
    const existingUser = await this.userRepo.findOne({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new BadRequestException(`Email đã được ${dto.email} sử dụng`);
    }

    // ✅ Hash password bằng argon2
    const passwordHash = await argon2.hash(dto.password);

    const user = this.userRepo.create({
      email: dto.email,
      full_name: dto.full_name,
      password_hash: passwordHash,
      role_id: 2, // mặc định role CANDIDATE
    });

    return this.userRepo.save(user);
  }

  async updatePassword(userId: number, dto: ChangePasswordDto) {
    // Lấy user từ DB
    const user = await this.userRepo.findOne({ where: { user_id: userId } });
    if (!user) throw new UnauthorizedException('User không tìm thấy');

    console.log('--- DEBUG UPDATE PASSWORD ---');
    console.log('userId:', userId);
    console.log('oldPassword nhập:', dto.oldPassword);
    console.log('hash DB:', user.password_hash);

    // So sánh mật khẩu cũ với hash trong DB
    const validOld = await argon2.verify(
      user.password_hash,
      dto.oldPassword.trim(),
    );
    console.log('Kết quả compare argon2:', validOld);

    if (!validOld) throw new BadRequestException('Mật khẩu cũ không đúng');

    // Kiểm tra mật khẩu mới và xác nhận
    if (dto.newPassword !== dto.confirmPassword)
      throw new BadRequestException('Mật khẩu xác nhận không khớp');

    // Hash mật khẩu mới và lưu
    user.password_hash = await argon2.hash(dto.newPassword.trim());
    await this.userRepo.save(user);

    return { message: 'Cập nhật mật khẩu thành công' };
  }
  async forgotPassword(email: string) {
    console.log('>>> forgotPassword:', email);

    try {
      const user = await this.userRepo.findOne({ where: { email } });
      if (!user) throw new BadRequestException('Email không tồn tại');

      const newPass = crypto.randomBytes(4).toString('hex');
      user.password_hash = await bcrypt.hash(newPass, 10);
      await this.userRepo.save(user);

      console.log('>>> Sending mail to:', user.email);

      await this.mailerService.sendMail({
        to: user.email,
        subject: 'Gửi mật khẩu mới',
        template: 'reset-password', // Sử dụng template
        context: {
          // resetLink: `https://example.com/reset-password?token=${newPass}`, // khớp {{resetLink}}
          newPassword: newPass,
          // token: newPass,
        },
      });

      return {
        message:
          'Mật khẩu mới đã được gửi đến email của bạn! Vui lòng kiểm tra trong email của bạn',
      };
    } catch (error) {
      console.error(' forgotPassword ERROR:', error);
      throw new InternalServerErrorException('Server bị lỗi');
    }
  }

  async updateUser(
    userId: number,
    dto: UpdateUserDto,
    file?: Express.Multer.File,
  ): Promise<UserEntity> {
    const user = await this.userRepo.findOne({ where: { user_id: userId } });
    if (!user) {
      throw new NotFoundException('Không tìm thấy user');
    }

    if (file) {
      try {
        const result = await this.cloudinaryService.uploadFile(file);
        if ('secure_url' in result) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          dto.avatar_url = result.secure_url;
        } else {
          throw new BadRequestException('Upload avatar thất bại');
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (err) {
        throw new BadRequestException('Upload avatar thất bại');
      }
    }

    Object.assign(user, dto);
    return this.userRepo.save(user);
  }
}
