import { Global, Injectable, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../config/env';
import { DataCipher } from './crypto';

/** The app-wide DataCipher, keyed from DATA_ENCRYPTION_KEY. */
@Injectable()
export class Encryption extends DataCipher {
  constructor(config: ConfigService<Env, true>) {
    const key = config.get('DATA_ENCRYPTION_KEY', { infer: true });
    super(key ?? `dev-only:${config.get('JWT_ACCESS_SECRET', { infer: true })}`);
  }
}

@Global()
@Module({ providers: [Encryption], exports: [Encryption] })
export class SecurityModule {}
