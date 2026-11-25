import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthUser } from '../../common/auth/auth-user';
import { CurrentUser } from '../../common/auth/decorators';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { AddressesService } from './addresses.service';
import { AddressDto } from './dto';

/** Address book. Every write returns the updated list, default first. */
@Controller('me/addresses')
@UseGuards(JwtAuthGuard)
export class AddressesController {
  constructor(private readonly addresses: AddressesService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  async list(@CurrentUser() user: AuthUser) {
    return { items: await this.addresses.list(user.id) };
  }

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: AddressDto) {
    return { items: await this.addresses.create(user.id, dto) };
  }

  @Put(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddressDto,
  ) {
    return { items: await this.addresses.update(user.id, id, dto) };
  }

  @Post(':id/default')
  @HttpCode(HttpStatus.OK)
  async setDefault(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return { items: await this.addresses.setDefault(user.id, id) };
  }

  @Delete(':id')
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return { items: await this.addresses.remove(user.id, id) };
  }
}
