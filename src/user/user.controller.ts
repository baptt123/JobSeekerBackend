import { Body, Controller, Param, Put } from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateUserDto } from '../dto/update-user.dto';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // @Put(':id')
  // async update(@Param('id') id: number, @Body() dto: UpdateUserDto) {
  //   // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  //   return await this.userService.updateUser(id, dto);
  // }
}
