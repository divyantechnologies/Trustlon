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
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthUser } from '../../../middlewares/auth/auth-user';
import { CurrentUser } from '../../../middlewares/auth/decorators';
import { JwtAuthGuard } from '../../../middlewares/auth/jwt-auth.guard';
import { RefreshCookie } from '../../auth/refresh-cookie';
import {
  ChangePasswordDto,
  ContactOtpDto,
  ContactVerifyDto,
  DeleteAccountDto,
  NotificationPreferencesDto,
  UpdateProfileDto,
} from './dto';
import { SettingsService } from './settings.service';

const STRICT = { default: { limit: 5, ttl: 60_000 } };

/** Account settings (spec 3.11). */
@Controller('me')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly cookie: RefreshCookie,
  ) {}

  @Get('settings')
  @Header('Cache-Control', 'private, no-store')
  overview(@CurrentUser() user: AuthUser) {
    return this.settings.overview(user.id);
  }

  @Patch()
  async updateProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return { profile: await this.settings.updateProfile(user.id, dto) };
  }

  @Post('contact/otp')
  @HttpCode(HttpStatus.OK)
  @Throttle(STRICT)
  sendContactCode(@CurrentUser() user: AuthUser, @Body() dto: ContactOtpDto, @Req() req: Request) {
    return this.settings.sendContactCode(user.id, dto, { ip: req.ip });
  }

  @Post('contact/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async verifyContact(@CurrentUser() user: AuthUser, @Body() dto: ContactVerifyDto) {
    return { profile: await this.settings.verifyContact(user.id, dto) };
  }

  @Post('password')
  @HttpCode(HttpStatus.OK)
  @Throttle(STRICT)
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.settings.changePassword(user, dto);
  }

  @Get('sessions')
  @Header('Cache-Control', 'private, no-store')
  sessions(@CurrentUser() user: AuthUser) {
    return this.settings.sessions(user.id, user.sessionId);
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeSession(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.settings.revokeSession(user.id, user.sessionId, id);
  }

  @Delete('sessions')
  revokeOtherSessions(@CurrentUser() user: AuthUser) {
    return this.settings.revokeOtherSessions(user.id, user.sessionId);
  }

  @Patch('notification-preferences')
  updateNotifications(@CurrentUser() user: AuthUser, @Body() dto: NotificationPreferencesDto) {
    return this.settings.updateNotifications(user.id, dto.channels);
  }

  @Post('data-export')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60 * 60_000 } })
  @Header('Cache-Control', 'private, no-store')
  async exportData(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Disposition', `attachment; filename="trustlon-my-data-${date}.json"`);
    return this.settings.exportData(user.id);
  }

  @Post('delete')
  @HttpCode(HttpStatus.OK)
  @Throttle(STRICT)
  async deleteAccount(
    @CurrentUser() user: AuthUser,
    @Body() dto: DeleteAccountDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.settings.deleteAccount(user.id, dto);
    this.cookie.clear(res);
    return result;
  }
}
