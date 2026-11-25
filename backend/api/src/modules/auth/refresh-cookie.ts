import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';
import { Env } from '../../config/env';
import { REFRESH_COOKIE_NAME, REFRESH_COOKIE_PATH } from './auth.constants';

@Injectable()
export class RefreshCookie {
  constructor(private readonly config: ConfigService<Env, true>) {}

  read(request: Request): string | undefined {
    const value = request.cookies?.[REFRESH_COOKIE_NAME];
    return typeof value === 'string' ? value : undefined;
  }

  set(response: Response, token: string, expiresAt: Date): void {
    response.cookie(REFRESH_COOKIE_NAME, token, { ...this.baseOptions(), expires: expiresAt });
  }

  clear(response: Response): void {
    response.clearCookie(REFRESH_COOKIE_NAME, this.baseOptions());
  }

  private baseOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.get('COOKIE_SECURE', { infer: true }),
      sameSite: 'lax',
      path: REFRESH_COOKIE_PATH,
      domain: this.config.get('COOKIE_DOMAIN', { infer: true }),
    };
  }
}
