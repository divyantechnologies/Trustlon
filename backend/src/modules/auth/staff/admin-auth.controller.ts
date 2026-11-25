import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AdminGuard } from '../../../middlewares/admin/admin.guard';
import { AuthUser } from '../../../middlewares/auth/auth-user';
import { CurrentUser } from '../../../middlewares/auth/decorators';
import { IssuedSession, RequestMeta } from '../services/session.service';
import { AdminAuthService, toStaffUser } from './admin-auth.service';
import { AdminRefreshCookie } from './admin-refresh-cookie';
import {
  ChallengeDto,
  ChangeOwnPasswordDto,
  CodeDto,
  NewPasswordDto,
  StaffLoginDto,
  TotpDto,
} from './dto';

const STRICT = { default: { limit: 5, ttl: 60_000 } };
const MODERATE = { default: { limit: 10, ttl: 60_000 } };

/** Staff sign-in for the admin panel. Two-factor authentication is mandatory (5.10). */
@Controller('admin/auth')
export class AdminAuthController {
  constructor(
    private readonly auth: AdminAuthService,
    private readonly cookie: AdminRefreshCookie,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle(STRICT)
  login(@Body() dto: StaffLoginDto, @Req() req: Request) {
    return this.auth.login(dto.email, dto.password, meta(req));
  }

  @Post('password')
  @HttpCode(HttpStatus.OK)
  @Throttle(MODERATE)
  setPassword(@Body() dto: NewPasswordDto) {
    return this.auth.setPassword(dto.challengeToken, dto.newPassword);
  }

  @Post('2fa/setup')
  @HttpCode(HttpStatus.OK)
  @Throttle(MODERATE)
  setup(@Body() dto: ChallengeDto) {
    return this.auth.setup(dto.challengeToken);
  }

  @Post('2fa/enroll')
  @HttpCode(HttpStatus.OK)
  @Throttle(STRICT)
  async enroll(
    @Body() dto: TotpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.enroll(dto.challengeToken, dto.code ?? '', meta(req));
    return { ...this.sessionResponse(result, res), recoveryCodes: result.recoveryCodes };
  }

  @Post('2fa/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle(STRICT)
  async verify(
    @Body() dto: TotpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.sessionResponse(
      await this.auth.verify(dto.challengeToken, dto.code, dto.recoveryCode, meta(req)),
      res,
    );
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      return this.sessionResponse(await this.auth.refresh(this.cookie.read(req)), res);
    } catch (error) {
      this.cookie.clear(res);
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(this.cookie.read(req));
    this.cookie.clear(res);
  }

  @Get('me')
  @UseGuards(AdminGuard)
  me(@CurrentUser() user: AuthUser) {
    return this.auth.profile(user.id);
  }

  @Patch('me/password')
  @UseGuards(AdminGuard)
  @Throttle(STRICT)
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangeOwnPasswordDto,
  ): Promise<void> {
    await this.auth.changePassword(user.id, user.sessionId, dto.currentPassword, dto.newPassword);
  }

  @Post('me/recovery-codes')
  @UseGuards(AdminGuard)
  @Throttle(STRICT)
  @HttpCode(HttpStatus.OK)
  recoveryCodes(@CurrentUser() user: AuthUser, @Body() dto: CodeDto) {
    return this.auth.newRecoveryCodes(user.id, dto.code);
  }

  private sessionResponse(session: IssuedSession, res: Response) {
    if (session.refreshToken && session.refreshTokenExpiresAt) {
      this.cookie.set(res, session.refreshToken, session.refreshTokenExpiresAt);
    }
    return {
      accessToken: session.accessToken,
      expiresInSeconds: session.accessTokenExpiresIn,
      user: toStaffUser(session.user),
    };
  }
}

function meta(req: Request): RequestMeta {
  const userAgent = req.headers['user-agent'];
  return { ip: req.ip, userAgent: typeof userAgent === 'string' ? userAgent : undefined };
}
