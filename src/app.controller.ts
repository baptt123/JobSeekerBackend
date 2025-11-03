import { Controller, Get, Render } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('render-login') // Đường dẫn này là đúng
  @Render('login') // Tên file HBS (không cần .hbs) <-- Sửa lại comment ở đây
  loginPage() {
    // Dữ liệu này sẽ được truyền vào file login.hbs
    return { title: 'Trang Đăng nhập' };
  }
  @Get('dashboard')
  @Render('dashboard') // Chúng ta sẽ đặt tên file HBS là 'dashboard-single-file.hbs'
  dashboard() {
    const applicantData = [
      {
        avatar: 'https://i.pravatar.cc/150?img=1',
        name: 'Dhimas Adit',
        email: 'dhimas@gmail.com',
        department: 'QA (Quality Assurance)',
        position: 'QA (Quality Assurance)',
        date: '22 Des 2022',
        time: '10:45 WB',
        status: 'Pending Interview',
      },
      {
        avatar: 'https://i.pravatar.cc/150?img=2',
        name: 'Dhimas Adit',
        email: 'dhimas@gmail.com',
        department: 'QA (Quality Assurance)',
        position: 'QA (Quality Assurance)',
        date: '22 Des 2022',
        time: '10:45 WB',
        status: 'Pending Interview',
      },
    ];

    return {
      username: 'Jhon',
      pageTitle: 'Dashboard',
      applicants: applicantData,
    };
  }
  @Get('manage-jobs')
  @Render('manage-job')
  manageJobs() {
    // Trả về một object, các key sẽ là biến trong file HBS
    return {
      tenNguoiDung: 'Jhon', // Biến {{ tenNguoiDung }} sẽ được thay thế bằng 'Jhon'
    };
  }
  @Get('create-job') // Hoặc @Get('tao-lowongan')
  @Render('create-job') // Tên file là 'index.hbs'
  createPage() {
    return {
      tenNguoiDung: 'Jhon', // Truyền biến cho HBS
    };
  }
  @Get('list-interviewer') // Hoặc @Get('kandidat')
  @Render('list-interviewer') // Tên file là 'index.hbs'
  CandidateList() {
    // Dữ liệu giả để hiển thị trong bảng
    const danhSachUngVien = [
      {
        avatar: 'https://placehold.co/40x40/FFC0CB/333333?text=DA',
        nama: 'Dhimas Adit',
        email: 'dhimas@gmail.com',
        departemen: 'QA (Quality Assurance)',
        posisi: 'QA (Quality Assurance)',
        waktuTanggal: '22 Des 2022',
        waktuJam: '10 : 45 WIB',
        status: 'Pending Interview',
      },
      {
        avatar: 'https://placehold.co/40x40/C0FFEE/333333?text=DA',
        nama: 'Dhimas Adit',
        email: 'dhimas@gmail.com',
        departemen: 'QA (Quality Assurance)',
        posisi: 'QA (Quality Assurance)',
        waktuTanggal: '22 Des 2022',
        waktuJam: '10 : 45 WIB',
        status: 'Pending Interview',
      },
      // Thêm 4 ứng viên khác tương tự
      {
        avatar: 'https://placehold.co/40x40/FFD700/333333?text=DA',
        nama: 'Dhimas Adit',
        email: 'dhimas@gmail.com',
        departemen: 'QA (Quality Assurance)',
        posisi: 'QA (Quality Assurance)',
        waktuTanggal: '22 Des 2022',
        waktuJam: '10 : 45 WIB',
        status: 'Pending Interview',
      },
      {
        avatar: 'https://placehold.co/40x40/98FB98/333333?text=DA',
        nama: 'Dhimas Adit',
        email: 'dhimas@gmail.com',
        departemen: 'QA (Quality Assurance)',
        posisi: 'QA (Quality Assurance)',
        waktuTanggal: '22 Des 2022',
        waktuJam: '10 : 45 WIB',
        status: 'Pending Interview',
      },
      {
        avatar: 'https://placehold.co/40x40/ADD8E6/333333?text=DA',
        nama: 'Dhimas Adit',
        email: 'dhimas@gmail.com',
        departemen: 'QA (Quality Assurance)',
        posisi: 'QA (Quality Assurance)',
        waktuTanggal: '22 Des 2022',
        waktuJam: '10 : 45 WIB',
        status: 'Pending Interview',
      },
      {
        avatar: 'https://placehold.co/40x40/E6E6FA/333333?text=DA',
        nama: 'Dhimas Adit',
        email: 'dhimas@gmail.com',
        departemen: 'QA (Quality Assurance)',
        posisi: 'QA (Quality Assurance)',
        waktuTanggal: '22 Des 2022',
        waktuJam: '10 : 45 WIB',
        status: 'Pending Interview',
      },
    ];

    return {
      tenNguoiDung: 'Jhon',
      ungVienList: danhSachUngVien, // Truyền mảng này vào HBS
    };
  }
  @Get('manage-cv') // Hoặc @Get('kandidat/detail')
  @Render('manage-cv') // Tên file là 'index.hbs'
  showCandidateDetail() {
    // Bạn có thể truyền dữ liệu CV động vào đây
    // Nhưng trong ví dụ này, tôi chỉ truyền tên người dùng
    // vì nội dung CV đã được hard-code theo ảnh
    return {
      tenNguoiDung: 'Jhon',
    };
  }
}
