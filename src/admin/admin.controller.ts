import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Render,
  UseGuards,
} from '@nestjs/common';
import { OrAuthGuard } from '../guard/or-auth.guard';
import { Roles } from '../decorator/role.decorator';
import { AdminService } from './admin.service';
import { AdminCreateCompanyDto } from '../admin-dto/admin-create-company.dto';

@Controller('admin')
@UseGuards(OrAuthGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly service: AdminService) {}

  @Delete('users/:id')
  async deleteUser(@Param('id') id: string) {
    return this.service.deleteUser(+id);
  }

  @Post('company')
  async createCompany(@Body() dto: AdminCreateCompanyDto) {
    return this.service.createCompany(dto);
  }

  @Post('assign-recruiter')
  async assignRecruiter(
    @Body('userId') userId: number,
    @Body('companyId') companyId: number,
  ) {
    return this.service.assignRecruiterToCompany(userId, companyId);
  }
  @Get('dashboard')
  @Render('admin/dashboard') // <--- Trỏ tới file views/admin/dashboard.hbs
  async getDashboard() {
    const stats = await this.service.getDashboardStats();
    // Trả về object chứa data để HBS hiển thị
    return { stats };
  }

  @Get('users')
  @Render('admin/users') // <--- Trỏ tới file views/admin/users.hbs
  async getAllUsers(@Query('page') page = 1, @Query('limit') limit = 10) {
    const result = await this.service.getAllUsers(Number(page), Number(limit));
    return {
      users: result.data,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
    };
  }
}
