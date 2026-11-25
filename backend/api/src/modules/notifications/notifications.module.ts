import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../config/env';
import { ConsoleOtpSender, OTP_SENDER } from './otp-sender';

@Module({
  providers: [
    ConsoleOtpSender,
    {
      provide: OTP_SENDER,
      inject: [ConfigService, ConsoleOtpSender],
      useFactory: (config: ConfigService<Env, true>, consoleSender: ConsoleOtpSender) => {
        switch (config.get('OTP_PROVIDER', { infer: true })) {
          case 'console':
          default:
            return consoleSender;
        }
      },
    },
  ],
  exports: [OTP_SENDER],
})
export class NotificationsModule {}
