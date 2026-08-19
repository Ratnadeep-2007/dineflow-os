import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ReservationsGateway } from '../websocket/reservations.gateway';
import { NotificationService } from '../notification/notification.service';
import { sanitizeText } from '../utils/sanitizer';

// ──────────────────────────────────────────────────────────────
// DTOs
// ──────────────────────────────────────────────────────────────
interface WhatsAppBookingDto {
  phone: string;
  partySize: number;
  cart: Array<{ menuItemId: string; name: string; quantity: number; unitPrice: number }>;
  type: 'DINE_IN';
  source: 'WHATSAPP_BOT' | 'TELEGRAM_BOT';
  guestName?: string;
}

interface WhatsAppOrderDto {
  phone: string;
  orderType: 'TAKEAWAY' | 'DELIVERY';
  cart: Array<{ menuItemId: string; name: string; quantity: number; unitPrice: number }>;
  orderRef: string;
  source: 'WHATSAPP_BOT' | 'TELEGRAM_BOT';
  guestName?: string;
}

// ──────────────────────────────────────────────────────────────
// Controller — receives pushes from the Baileys gateway and
// broadcasts them to the React dashboard via WebSocket
// ──────────────────────────────────────────────────────────────
@Controller('webhook')
export class TicketQueueController {
  private readonly logger = new Logger(TicketQueueController.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly gateway: ReservationsGateway,
    private readonly notifications: NotificationService,
  ) {}

  // ── POST /webhook/whatsapp-booking (Dine-In table requests) ──
  @Post('whatsapp-booking')
  @HttpCode(HttpStatus.OK)
  async receiveWhatsAppBooking(@Body() dto: WhatsAppBookingDto) {
    this.logger.log(`[TicketQueue] Dine-In booking from ${dto.phone}, party: ${dto.partySize}`);

    if (!dto.phone || !dto.partySize || dto.partySize < 1 || dto.partySize > 20) {
      throw new BadRequestException('Invalid booking payload');
    }

    const cleanPhone = sanitizeText(dto.phone);
    const cartTotal = dto.cart.reduce((s, c) => s + c.quantity * c.unitPrice, 0);

    // 1. Upsert guest user
    const userId = await this.upsertUser(cleanPhone);

    // 2. Insert reservation as PENDING
    const resResult = await this.db.query(
      `INSERT INTO reservations
         (user_id, party_size, reservation_time, status, source, special_requests)
       VALUES ($1, $2, NOW() + INTERVAL '30 minutes', 'PENDING', 'WHATSAPP', $3)
       RETURNING *`,
      [userId, dto.partySize, dto.cart.length > 0 ? `Pre-order: ${dto.cart.map(c => `${c.name}×${c.quantity}`).join(', ')}` : null],
    );
    const reservation = resResult.rows[0];

    // 3. Store cart items in orders table linked to this reservation
    if (dto.cart.length > 0) {
      const orderRes = await this.db.query(
        `INSERT INTO orders (reservation_id, user_id, order_type, total_amount, status)
         VALUES ($1, $2, 'DINE_IN', $3, 'PENDING')
         RETURNING id`,
        [reservation.id, userId, cartTotal],
      ).catch(() => null); // graceful — orders table may not have reservation_id column yet

      if (orderRes?.rows[0]) {
        const orderId = orderRes.rows[0].id;
        for (const item of dto.cart) {
          await this.db.query(
            `INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price)
             VALUES ($1, $2, $3, $4)`,
            [orderId, item.menuItemId, item.quantity, item.unitPrice],
          ).catch(() => null);
        }
      }
    }

    // 4. Build enriched ticket payload for the dashboard
    const dashboardSource = dto.source === 'TELEGRAM_BOT' ? 'TELEGRAM' : 'WHATSAPP';
    const guestLabel = dto.guestName ?? `Guest_${cleanPhone.slice(-4)}`;
    const ticket = {
      id: reservation.id,
      ticketType: 'DINE_IN' as const,
      name: guestLabel,
      phone_number: cleanPhone,
      party_size: dto.partySize,
      original_party_size: dto.partySize,
      status: 'PENDING' as const,
      source: dashboardSource,
      reservation_time: reservation.reservation_time,
      created_at: reservation.created_at,
      cart: dto.cart,
      cartTotal,
      special_requests: reservation.special_requests,
    };

    // 5. Broadcast to all connected dashboard clients
    this.gateway.broadcastBookingCreated(ticket);
    this.logger.log(`[TicketQueue] Broadcasted DINE_IN ticket ${ticket.id} to dashboard`);

    return { status: 'queued', ticketId: ticket.id };
  }

  // ── POST /webhook/whatsapp-order (Takeaway orders) ────────────
  @Post('whatsapp-order')
  @HttpCode(HttpStatus.OK)
  async receiveWhatsAppOrder(@Body() dto: WhatsAppOrderDto) {
    this.logger.log(`[TicketQueue] ${dto.orderType} order from ${dto.phone}, ref: ${dto.orderRef}`);

    if (!dto.phone || !dto.cart || dto.cart.length === 0) {
      throw new BadRequestException('Invalid order payload');
    }

    const cleanPhone = sanitizeText(dto.phone);
    const cartTotal = dto.cart.reduce((s, c) => s + c.quantity * c.unitPrice, 0);

    // 1. Upsert user
    const userId = await this.upsertUser(cleanPhone);

    // 2. Insert order record
    const orderRes = await this.db.query(
      `INSERT INTO orders (user_id, order_type, total_amount, status)
       VALUES ($1, $2, $3, 'PENDING')
       RETURNING *`,
      [userId, dto.orderType, cartTotal],
    );
    const order = orderRes.rows[0];

    // 3. Insert order items
    for (const item of dto.cart) {
      await this.db.query(
        `INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price)
         VALUES ($1, $2, $3, $4)`,
        [order.id, item.menuItemId, item.quantity, item.unitPrice],
      ).catch(() => null);
    }

    // 4. Build enriched ticket for dashboard
    const dashboardSource2 = dto.source === 'TELEGRAM_BOT' ? 'TELEGRAM' : 'WHATSAPP';
    const guestLabel2 = dto.guestName ?? `Guest_${cleanPhone.slice(-4)}`;
    const ticket = {
      id: order.id,
      ticketType: dto.orderType as 'TAKEAWAY',
      name: guestLabel2,
      phone_number: cleanPhone,
      party_size: 0,
      original_party_size: 0,
      status: 'PENDING' as const,
      source: dashboardSource2,
      orderRef: dto.orderRef,
      reservation_time: new Date().toISOString(),
      created_at: order.created_at || new Date().toISOString(),
      cart: dto.cart,
      cartTotal,
    };

    // 5. Broadcast to dashboard — reusing booking.created for queue ingest
    this.gateway.broadcastBookingCreated(ticket);
    this.logger.log(`[TicketQueue] Broadcasted ${dto.orderType} ticket ${ticket.id} to dashboard`);

    return { status: 'queued', ticketId: ticket.id, orderRef: dto.orderRef };
  }

  // ── GET /webhook/tickets — fetch all active pending tickets ──
  @Get('tickets')
  async getActiveTickets() {
    const reservations = await this.db.query(
      `SELECT r.*, u.phone_number, u.name,
              'DINE_IN' as ticket_type
       FROM reservations r
       JOIN users u ON r.user_id = u.id
       WHERE r.status IN ('PENDING', 'CONFIRMED')
       ORDER BY r.created_at DESC
       LIMIT 100`,
    );

    const orders = await this.db.query(
      `SELECT o.*, u.phone_number, u.name,
              o.order_type as ticket_type
       FROM orders o
       JOIN users u ON o.user_id = u.id
       WHERE o.status = 'PENDING'
         AND o.order_type = 'TAKEAWAY'
       ORDER BY o.created_at DESC
       LIMIT 100`,
    ).catch(() => ({ rows: [] }));

    return {
      tickets: [
        ...reservations.rows.map((r) => ({ ...r, source: 'WHATSAPP' })),
        ...orders.rows.map((o) => ({ ...o, source: 'WHATSAPP' })),
      ],
    };
  }

  // ── PATCH /webhook/tickets/:id/resolve — mark ticket done ────
  @Patch('tickets/:id/resolve')
  async resolveTicket(
    @Param('id') id: string,
    @Body() body: { resolution: 'CONFIRMED' | 'CANCELLED'; tableId?: string },
  ) {
    this.logger.log(`[TicketQueue] Resolving ticket ${id} → ${body.resolution}`);

    // Try reservation first
    const resUpdate = await this.db.query(
      `UPDATE reservations SET status = $1, updated_at = NOW()
       WHERE id = $2 RETURNING *, user_id`,
      [body.resolution, id],
    );

    if (resUpdate.rows.length > 0) {
      const res = resUpdate.rows[0];

      // Optionally assign table
      if (body.tableId && body.resolution === 'CONFIRMED') {
        await this.db.query(
          `UPDATE tables SET status = 'RESERVED' WHERE id = $1`,
          [body.tableId],
        ).catch(() => null);
        await this.db.query(
          `UPDATE reservations SET table_id = $1 WHERE id = $2`,
          [body.tableId, id],
        ).catch(() => null);
      }

      // Fetch phone to notify guest via WhatsApp
      const userRes = await this.db.query(
        `SELECT phone_number, name FROM users WHERE id = $1`,
        [res.user_id],
      );
      const user = userRes.rows[0];

      if (user) {
        const msg =
          body.resolution === 'CONFIRMED'
            ? `🎉 Great news, ${user.name || 'there'}! Your table for ${res.party_size} guests has been confirmed. We look forward to seeing you!`
            : `❌ We're sorry, your reservation has been cancelled. Type *Hi* to start a new booking anytime.`;

        await this.notifications.recordInboundMessage(user.phone_number);
        await this.notifications.sendWhatsAppMessage(user.phone_number, msg);
      }

      // Broadcast updated status to dashboard
      this.gateway.broadcastBookingUpdated({ ...res, status: body.resolution });
      return { status: 'updated', id };
    }

    // Try orders table
    const orderUpdate = await this.db.query(
      `UPDATE orders SET status = $1 WHERE id = $2 RETURNING *`,
      [body.resolution, id],
    ).catch(() => ({ rows: [] }));

    if (orderUpdate.rows.length > 0) {
      this.gateway.broadcastBookingUpdated({ ...orderUpdate.rows[0], status: body.resolution });
      return { status: 'updated', id };
    }

    throw new NotFoundException(`Ticket ${id} not found`);
  }

  // ── Helper: upsert user by phone ─────────────────────────────
  private async upsertUser(phone: string): Promise<string> {
    const existing = await this.db.query(
      `SELECT id FROM users WHERE phone_number = $1`,
      [phone],
    );
    if (existing.rows.length > 0) return existing.rows[0].id;

    const inserted = await this.db.query(
      `INSERT INTO users (phone_number, name) VALUES ($1, $2) RETURNING id`,
      [phone, `Guest_${phone.slice(-4)}`],
    );
    return inserted.rows[0].id;
  }
}
