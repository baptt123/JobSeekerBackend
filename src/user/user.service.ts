import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { UserEntity } from '../entity/user.entity';
import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { RegisterDto } from '../dto/register.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { MailerService } from '@nestjs-modules/mailer';
import crypto from 'crypto';
import * as argon2 from 'argon2';
import { UpdateUserDto } from '../dto/update-user.dto';
import { CloudinaryCustomService } from '../cloudinary-custom/cloudinary-custom.service';
import { FirebaseModuleService } from '../firebase-module/firebase-module.service';
@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserEntity)
    public readonly userRepo: Repository<UserEntity>,
    private readonly mailerService: MailerService,
    private readonly cloudinaryService: CloudinaryCustomService,
    @Inject(forwardRef(() => FirebaseModuleService))
    private readonly firebaseService: FirebaseModuleService,
  ) {}
  // 1. ĐĂNG KÝ
  async create(dto: RegisterDto): Promise<UserEntity> {
    const existingUser = await this.userRepo.findOne({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new BadRequestException(`Email ${dto.email} đã được sử dụng`);
    }

    // Hash password bằng argon2
    const passwordHash = await argon2.hash(dto.password);

    const user = this.userRepo.create({
      email: dto.email,
      full_name: dto.full_name,
      password_hash: passwordHash,
      role_id: 2, // Mặc định role CANDIDATE
    });

    // Save trả về entity đầy đủ
    return this.userRepo.save(user);
  }

  // 2. ĐỔI MẬT KHẨU
  async updatePassword(userId: number, dto: ChangePasswordDto) {
    // 🔥 SỬA: Thêm addSelect để lấy password_hash bị ẩn
    const user = await this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.password_hash')
      .where('user.user_id = :userId', { userId })
      .getOne();

    if (!user) throw new UnauthorizedException('User không tìm thấy');

    // ... (Giữ nguyên logic bên dưới)
    if (!user.password_hash) {
      throw new BadRequestException(
        'Tài khoản này chưa thiết lập mật khẩu (Đăng nhập Google)',
      );
    }

    // So sánh mật khẩu cũ
    const validOld = await argon2.verify(
      user.password_hash,
      dto.oldPassword.trim(),
    );

    if (!validOld) throw new BadRequestException('Mật khẩu cũ không đúng');

    // Kiểm tra confirm password (nên check cả ở DTO, nhưng check lại ở đây cho chắc)
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('Mật khẩu xác nhận không khớp');
    }

    // Kiểm tra mật khẩu mới không được trùng mật khẩu cũ
    const isSameAsOld = await argon2.verify(
      user.password_hash,
      dto.newPassword.trim(),
    );
    if (isSameAsOld) {
      throw new BadRequestException(
        'Mật khẩu mới không được trùng với mật khẩu cũ',
      );
    }

    // Hash mật khẩu mới và lưu
    user.password_hash = await argon2.hash(dto.newPassword.trim());
    await this.userRepo.save(user);

    return { message: 'Cập nhật mật khẩu thành công' };
  }

  // 3. QUÊN MẬT KHẨU (Fix lỗi dùng sai thư viện hash)
  // 3. QUÊN MẬT KHẨU
  async forgotPassword(email: string) {
    try {
      // 🔥 BƯỚC 1: Kiểm tra email có trong DB không
      const user = await this.userRepo.findOne({ where: { email } });

      if (!user) {
        // ❌ Nếu không có: Báo lỗi ngay lập tức
        throw new BadRequestException(
          'Email này chưa được đăng ký trong hệ thống.',
        );
      }

      // 🔥 BƯỚC 2: Nếu có user -> Xử lý tạo mật khẩu mới
      // Tạo mật khẩu ngẫu nhiên (8 bytes = 16 ký tự hex)
      const newPass = crypto.randomBytes(4).toString('hex');

      // Hash mật khẩu mới
      user.password_hash = await argon2.hash(newPass);
      await this.userRepo.save(user);

      // Gửi mail
      await this.mailerService.sendMail({
        to: user.email,
        subject: '[TechConnect] Cấp lại mật khẩu mới',
        template: 'reset-password',
        context: {
          newPassword: newPass,
          name: user.full_name,
        },
      });

      // ✅ Trả về thông báo thành công
      return {
        message: 'Thành công! Mật khẩu mới đã được gửi vào email của bạn.',
      };
    } catch (error) {
      // Nếu là lỗi BadRequest (do mình throw ở trên) thì ném tiếp ra ngoài cho Controller
      if (error instanceof BadRequestException) throw error;

      console.error('Forgot Password Error:', error);
      throw new InternalServerErrorException('Lỗi hệ thống khi gửi mail.');
    }
  }

  // 🔥 ĐIỀU CHỈNH LOGIC UPDATE USER 🔥
  async updateUser(
    userId: number,
    dto: UpdateUserDto,
    file?: Express.Multer.File,
  ): Promise<UserEntity> {
    const user = await this.userRepo.findOne({ where: { user_id: userId } });
    if (!user) throw new NotFoundException('Không tìm thấy user');

    // 1. Kiểm tra logic trùng Email (Thực tế rất quan trọng)
    if (dto.email && dto.email !== user.email) {
      const existingEmail = await this.userRepo.findOne({
        where: {
          email: dto.email,
          user_id: Not(userId), // Tìm xem có ai KHÁC đang dùng email này không
        },
      });
      if (existingEmail) {
        throw new ConflictException(
          'Email này đã được sử dụng bởi tài khoản khác',
        );
      }
    }

    // 2. Xử lý Upload Avatar
    if (file) {
      try {
        const result = await this.cloudinaryService.uploadFile(file);
        // Kiểm tra kết quả trả về từ Cloudinary
        if (result && 'secure_url' in result) {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          user.avatar_url = result.secure_url;
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (err) {
        throw new BadRequestException('Upload avatar lên Cloudinary thất bại');
      }
    } else if (dto.avatar_url) {
      // Trường hợp user không upload ảnh mới, nhưng gửi link (có thể link cũ hoặc link ngoài)
      user.avatar_url = dto.avatar_url;
    }

    // 3. Cập nhật các trường thông tin khác
    if (dto.full_name) user.full_name = dto.full_name;
    if (dto.phone) user.phone = dto.phone;
    if (dto.city) user.city = dto.city;
    if (dto.email) user.email = dto.email;

    // 4. Lưu vào DB
    const updatedUser = await this.userRepo.save(user);

    // 5. Quan trọng: Xóa password hash trước khi trả về frontend
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    delete updatedUser.password_hash;

    return updatedUser;
  }

  async getUserProfile(userId: number): Promise<UserEntity> {
    const user = await this.userRepo.findOne({ where: { user_id: userId } });
    if (!user) throw new NotFoundException('Không tìm thấy user');
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    delete user.password_hash;
    return user;
  }
}
