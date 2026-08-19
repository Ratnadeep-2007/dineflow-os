import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class WebhookGuard implements CanActivate {
  private readonly logger = new Logger(WebhookGuard.name);
  private readonly appSecret: string;

  constructor(private configService: ConfigService) {
    this.appSecret = this.configService.get<string>('META_APP_SECRET') || '';
    if (!this.appSecret || this.appSecret === 'meta_app_secret_placeholder') {
      this.logger.warn('META_APP_SECRET is not configured. Webhook signature verification will be bypassed or fail.');
    }
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const signatureHeader = request.headers['x-hub-signature-256'] as string;

    if (!signatureHeader) {
      this.logger.warn('Missing x-hub-signature-256 header in webhook request');
      throw new ForbiddenException('Missing signature header');
    }

    if (!signatureHeader.startsWith('sha256=')) {
      this.logger.warn('Invalid signature header format');
      throw new ForbiddenException('Invalid signature format');
    }

    const rawBody = request.rawBody; // Captured by NestJS rawBody setting
    if (!rawBody) {
      this.logger.error('Raw body not captured. Check NestJS bootstrap settings.');
      throw new ForbiddenException('Raw body missing');
    }

    const payloadSignature = signatureHeader.substring(7); // Remove 'sha256='
    
    // Compute HMAC SHA256 signature
    // per security.md 3.3, constant-time comparison required to avoid timing attacks
    const hmac = crypto.createHmac('sha256', this.appSecret);
    const digest = hmac.update(rawBody).digest('hex');

    const digestBuffer = Buffer.from(digest, 'hex');
    const signatureBuffer = Buffer.from(payloadSignature, 'hex');

    if (digestBuffer.length !== signatureBuffer.length) {
      this.logger.warn('Signature digest length mismatch');
      throw new ForbiddenException('Signature mismatch');
    }

    // crypto.timingSafeEqual verifies signatures in constant time
    if (!crypto.timingSafeEqual(digestBuffer, signatureBuffer)) {
      this.logger.warn('HMAC verification failed for webhook request');
      throw new ForbiddenException('Signature verification failed');
    }

    this.logger.log('Inbound webhook signature verified successfully');
    return true;
  }
}
