import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthUser } from '../../common/auth/auth-user';
import { CurrentUser } from '../../common/auth/decorators';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { AuthService } from './auth.service';
import { toPublicUser } from './auth.presenter';
import {
  ForgotPasswordDto,
  LoginDto,
  ResetPasswordDto,
  SendOtpDto,
  SignupDetailsDto,
  SignupDto,
  VerifyOtpDto,
} from './dto/auth.dto';
import { RefreshCookie } from './refresh-cookie';
import { IssuedSession, RequestMeta } from './services/session.service';

const STRICT = { default: { limit: 5, ttl: 60_000 } };
const MODERATE = { default: { limit: 10, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly cookie: RefreshCookie,
  ) {}

  @Post('otp/send')
  @HttpCode(HttpStatus.OK)
  @Throttle(STRICT)
  sendOtp(@Body() dto: SendOtpDto, @Req() req: Request) {
    return this.auth.sendOtp(dto, meta(req));
  }

  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle(MODERATE)
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.verifyOtp(dto, meta(req));
    if (result.kind === 'session') {
      return this.sessionResponse(result.session, res);
    }
    return {
      verificationToken: result.verificationToken,
      expiresInSeconds: result.expiresInSeconds,
    };
  }

  @Post('signup/validate')
  @HttpCode(HttpStatus.OK)
  @Throttle(MODERATE)
  validateSignup(@Body() dto: SignupDetailsDto) {
    return this.auth.validateSignup(dto);
  }

  @Post('signup')
  @Throttle(MODERATE)
  async signup(
    @Body() dto: SignupDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.sessionResponse(await this.auth.signup(dto, meta(req)), res);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle(MODERATE)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.sessionResponse(await this.auth.login(dto, meta(req)), res);
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

  @Post('password/forgot')
  @HttpCode(HttpStatus.OK)
  @Throttle(STRICT)
  forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    return this.auth.forgotPassword(dto, meta(req));
  }

  @Post('password/reset')
  @HttpCode(HttpStatus.OK)
  @Throttle(MODERATE)
  async resetPassword(@Body() dto: ResetPasswordDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.resetPassword(dto);
    this.cookie.clear(res);
    return result;
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AuthUser) {
    return { user: toPublicUser(await this.auth.getProfile(user.id)) };
  }

  private sessionResponse(session: IssuedSession, res: Response) {
    if (session.refreshToken && session.refreshTokenExpiresAt) {
      this.cookie.set(res, session.refreshToken, session.refreshTokenExpiresAt);
    }
    return {
      accessToken: session.accessToken,
      expiresInSeconds: session.accessTokenExpiresIn,
      user: toPublicUser(session.user),
    };
  }
}

function meta(req: Request): RequestMeta {
  const userAgent = req.headers['user-agent'];
  return { ip: req.ip, userAgent: typeof userAgent === 'string' ? userAgent : undefined };
}
