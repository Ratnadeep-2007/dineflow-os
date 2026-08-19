import { Module } from '@nestjs/common';
import { PaymentWebhookController } from './payment-webhook.controller';

@Module({
  controllers: [PaymentWebhookController],
})
export class PaymentWebhookModule {}
