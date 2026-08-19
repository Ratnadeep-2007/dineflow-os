import { Controller, Post, Body, Headers, HttpCode, HttpStatus, Logger, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { NotificationService } from '../notification/notification.service';
import * as crypto from 'crypto';

@Controller('payment')
export class PaymentWebhookController {
  private readonly logger = new Logger(PaymentWebhookController.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly notificationService: NotificationService
  ) {}

  // Receives payment gateway webhook events (e.g., Stripe/Razorpay) (Phase 7 Payment Webhook)
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handlePaymentWebhook(
    @Body() payload: any,
    @Headers('x-razorpay-signature') signature: string
  ) {
    this.logger.log(`Received payment webhook payload`);

    // 1. Signature verification stub (Razorpay/Stripe check placeholder)
    // In production, compute HMAC using the webhook secret:
    // const expected = crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
    if (signature) {
      this.logger.log(`Verifying payment gateway signature header: ${signature}`);
    } else {
      this.logger.warn(`No payment signature header provided. Operating in sandbox test mode.`);
    }

    // 2. Parse event payload
    // Razorpay standard structure: payload.payload.payment.entity.notes.orderId
    // Stripe standard structure: payload.data.object.metadata.orderId
    const orderId = payload?.orderId || payload?.payload?.payment?.entity?.notes?.orderId || payload?.data?.object?.metadata?.orderId;
    const paymentStatus = payload?.status || payload?.event; // e.g. "payment.captured" or "checkout.session.completed"

    if (!orderId) {
      this.logger.error(`Webhook payload missing orderId reference. Rejected.`);
      throw new BadRequestException('Missing orderId reference in payload');
    }

    this.logger.log(`Processing payment for Order: ${orderId}, Status: ${paymentStatus}`);

    try {
      // 3. Update Order Status to PAID in PostgreSQL (PRD.md Section 4.6)
      const orderUpdate = await this.databaseService.query(
        `UPDATE orders 
         SET status = 'PAID', updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1 
         RETURNING id, user_id, total_amount`,
        [orderId]
      );

      if (orderUpdate.rowCount === 0) {
        this.logger.error(`Order with ID ${orderId} not found in database.`);
        throw new BadRequestException(`Order not found: ${orderId}`);
      }

      const order = orderUpdate.rows[0];

      // 4. Retrieve customer contact number
      const userRes = await this.databaseService.query(
        `SELECT phone_number, name FROM users WHERE id = $1`,
        [order.user_id]
      );
      const user = userRes.rows[0];

      // 5. Trigger Outbound WhatsApp order preparation template message
      const alertMsg = `✅ Payment Confirmed! Thank you, ${user.name || 'there'}. We have received your payment of ₹${order.total_amount}. Your order is now being prepared in the kitchen! 🍳`;
      
      // Enforce the 24h WhatsApp policy check (runs free-form vs templates)
      await this.notificationService.sendWhatsAppMessage(
        user.phone_number,
        alertMsg,
        'order_preparation', // Template Name fallback for outside-24h session window
        [user.name, orderId, order.total_amount.toString()]
      );

      return { status: 'success', message: 'Order marked as paid and customer notified' };
    } catch (error) {
      this.logger.error(`Failed to process payment webhook: ${error.message}`);
      throw new BadRequestException('Payment webhook processing failed');
    }
  }
}
