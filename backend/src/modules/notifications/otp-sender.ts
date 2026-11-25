import { Injectable, Logger } from '@nestjs/common';
import { OtpChannel, OtpPurpose } from '@prisma/client';

export const OTP_SENDER = Symbol('OTP_SENDER');

export interface OtpMessage {
  channel: OtpChannel;
  target: string;
  code: string;
  purpose: OtpPurpose;
}

export interface OtpSender {
  send(message: OtpMessage): Promise<void>;
}

/**
 * Development and test provider. Prints the code to the API log instead of sending it.
 * Blocked in production by environment validation.
 */
@Injectable()
export class ConsoleOtpSender implements OtpSender {
  private readonly logger = new Logger('OTP');
  private readonly lastCodes = new Map<string, string>();

  async send(message: OtpMessage): Promise<void> {
    this.lastCodes.set(`${message.target}:${message.purpose}`, message.code);
    this.logger.log(`[${message.channel}] ${message.purpose} code for ${message.target}: ${message.code}`);
  }

  lastCodeFor(target: string, purpose: OtpPurpose): string | undefined {
    return this.lastCodes.get(`${target}:${purpose}`);
  }
}
