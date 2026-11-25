import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';
import { Env } from '../../config/env';

/** Separate from the storefront's tl_rt, so signing in to one panel never signs out the other. */
export const ADMIN_REFRESH_COOKIE = 'tl_admin_rt';
export const ADMIN_REFRESH_PATH = '/api/v1/admin/auth';

@Injectable()
export class AdminRefreshCookie {
  constructor(private readonly config: ConfigService<Env, true>) {}

  read(request: Request): string | undefined {
    const value = request.cookies?.[ADMIN_REFRESH_COOKIE];
    return typeof value === 'string' ? value : undefined;
  }

  set(response: Response, token: string, expiresAt: Date): void {
    response.cookie(ADMIN_REFRESH_COOKIE, token, { ...this.options(), expires: expiresAt });
  }

  clear(response: Response): void {
    response.clearCookie(ADMIN_REFRESH_COOKIE, this.options());
  }

  private options(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.get('COOKIE_SECURE', { infer: true }),
      // Strict: the admin panel is never opened from another site's link with a session.
      sameSite: 'strict',
      path: ADMIN_REFRESH_PATH,
      domain: this.config.get('COOKIE_DOMAIN', { infer: true }),
    };
  }
}
