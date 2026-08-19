import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { NotificationService } from '../notification/notification.service';
import { sanitizeText } from '../utils/sanitizer';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ReservationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ReservationsGateway.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly notificationService: NotificationService
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected to dashboard WebSockets: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected from dashboard WebSockets: ${client.id}`);
  }

  // Broadcasts a new booking to all connected dashboards (architecture.md Section 9)
  broadcastBookingCreated(booking: any) {
    this.logger.log(`Broadcasting booking.created for ID: ${booking.id}`);
    this.server.emit('booking.created', booking);
  }

  // Broadcasts booking changes to all connected dashboards (architecture.md Section 9)
  broadcastBookingUpdated(booking: any) {
    this.logger.log(`Broadcasting booking.updated for ID: ${booking.id}`);
    this.server.emit('booking.updated', booking);
  }

  // Subscribe to walk-in booking creation from receptionist (dashboard -> server) (security.md Section 7)
  @SubscribeMessage('booking.create')
  async handleCreateBooking(
    @MessageBody() data: { name: string; phone_number: string; party_size: number; reservation_time?: string; table_id?: string; special_requests?: string },
    @ConnectedSocket() client: Socket
  ) {
    const { name, phone_number, party_size, reservation_time, table_id, special_requests } = data;
    this.logger.log(`Received booking.create event for Walk-in: ${name}`);

    try {
      // 1. Sanitise input strings against HTML/script injection (security.md Section 7)
      const cleanName = sanitizeText(name);
      const cleanPhone = sanitizeText(phone_number);
      const cleanNotes = sanitizeText(special_requests);

      // Validate party size bounds
      if (party_size <= 0 || party_size > 20) {
        client.emit('error', { message: 'Party size is out of realistic bounds (1-20)' });
        return;
      }

      // 2. Fetch or insert user
      let userResult = await this.databaseService.query(
        `SELECT id FROM users WHERE phone_number = $1`,
        [cleanPhone]
      );
      let userId: string;
      if (userResult.rowCount === 0) {
        const insertUser = await this.databaseService.query(
          `INSERT INTO users (phone_number, name) VALUES ($1, $2) RETURNING id`,
          [cleanPhone, cleanName]
        );
        userId = insertUser.rows[0].id;
      } else {
        userId = userResult.rows[0].id;
      }

      // 3. Insert reservation details (CONFIRMED if table assigned, otherwise PENDING)
      const status = table_id ? 'CONFIRMED' : 'PENDING';
      const timeVal = reservation_time ? new Date(reservation_time) : new Date();

      const insertRes = await this.databaseService.query(
        `INSERT INTO reservations (user_id, party_size, reservation_time, status, source, table_id, special_requests)
         VALUES ($1, $2, $3, $4, 'WALK_IN', $5, $6)
         RETURNING *`,
        [userId, party_size, timeVal, status, table_id || null, cleanNotes || null]
      );

      const booking = insertRes.rows[0];

      // Update table state if assigned
      if (table_id) {
        await this.databaseService.query(
          `UPDATE tables SET status = 'RESERVED' WHERE id = $1`,
          [table_id]
        );
      }

      // 4. Broadcast created booking to all dashboard active clients
      this.broadcastBookingCreated({
        ...booking,
        phone_number: cleanPhone,
        name: cleanName,
      });

      client.emit('booking.created.success', { reservationId: booking.id });
    } catch (error) {
      this.logger.error(`Error creating walk-in booking: ${error.message}`);
      client.emit('error', { message: 'Failed to create walk-in booking' });
    }
  }

  // Subscribe to booking confirmations from receptionist (dashboard -> server)
  @SubscribeMessage('booking.confirm')
  async handleConfirmBooking(
    @MessageBody() data: { reservationId: string; tableId: string },
    @ConnectedSocket() client: Socket
  ) {
    const { reservationId, tableId } = data;
    this.logger.log(`Received booking.confirm event for Reservation: ${reservationId}, Table: ${tableId}`);

    try {
      // 1. Update reservation in database to CONFIRMED
      const res = await this.databaseService.query(
        `UPDATE reservations 
         SET status = 'CONFIRMED', table_id = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 
         RETURNING id, user_id, party_size, reservation_time, status`,
        [tableId, reservationId]
      );

      if (res.rowCount === 0) {
        client.emit('error', { message: 'Reservation not found' });
        return;
      }

      const booking = res.rows[0];

      // Update table status in database
      await this.databaseService.query(
        `UPDATE tables SET status = 'RESERVED' WHERE id = $1`,
        [tableId]
      );

      // 2. Fetch customer phone number
      const userRes = await this.databaseService.query(
        `SELECT phone_number, name FROM users WHERE id = $1`,
        [booking.user_id]
      );
      const user = userRes.rows[0];

      // 3. Broadcast updated status to all dashboard instances
      this.broadcastBookingUpdated(booking);

      // 4. Notify customer via WhatsApp + Offer pre-order flow (PRD.md Section 4.2 Step 5)
      const message = `🎉 Good news, ${user.name || 'there'}! Your reservation is confirmed for ${booking.party_size} guests at ${new Date(booking.reservation_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Would you like to pre-order food to save time at the restaurant?`;
      await this.notificationService.recordInboundMessage(user.phone_number); // Simulate active session
      await this.notificationService.sendWhatsAppMessage(user.phone_number, message);
      
      // Update session state in Redis for pre-order flow
      // We will define this state transition in detail in the FlowManager

      client.emit('booking.confirmed.success', { reservationId });
    } catch (error) {
      this.logger.error(`Error confirming booking: ${error.message}`);
      client.emit('error', { message: 'Failed to confirm booking' });
    }
  }

  // Subscribe to edits from receptionist (dashboard -> server)
  @SubscribeMessage('booking.edit')
  async handleEditBooking(
    @MessageBody() data: { reservationId: string; partySize?: number; reservationTime?: string; tableId?: string },
    @ConnectedSocket() client: Socket
  ) {
    const { reservationId, partySize, reservationTime, tableId } = data;
    this.logger.log(`Received booking.edit event for Reservation: ${reservationId}`);

    try {
      // 1. Fetch current reservation details
      const oldRes = await this.databaseService.query(
        `SELECT r.*, u.phone_number, u.name 
         FROM reservations r
         JOIN users u ON r.user_id = u.id
         WHERE r.id = $1`,
        [reservationId]
      );

      if (oldRes.rowCount === 0) {
        client.emit('error', { message: 'Reservation not found' });
        return;
      }

      const oldBooking = oldRes.rows[0];

      // 2. Build update query dynamically
      const fields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (partySize !== undefined) {
        fields.push(`party_size = $${paramIndex++}`);
        values.push(partySize);
      }
      if (reservationTime !== undefined) {
        fields.push(`reservation_time = $${paramIndex++}`);
        values.push(new Date(reservationTime));
      }
      if (tableId !== undefined) {
        fields.push(`table_id = $${paramIndex++}`);
        values.push(tableId);
      }

      fields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(reservationId); // Last element is ID

      const queryText = `
        UPDATE reservations 
        SET ${fields.join(', ')} 
        WHERE id = $${paramIndex} 
        RETURNING *`;

      const updateRes = await this.databaseService.query(queryText, values);
      const updatedBooking = updateRes.rows[0];

      // 3. Log Audit Trail (security.md Section 3.1 & architecture.md Section 3)
      await this.databaseService.query(
        `INSERT INTO audit_log (entity_type, entity_id, action, actor, before_state, after_state)
         VALUES ('RESERVATION', $1, 'UPDATE', 'RECEPTIONIST', $2, $3)`,
        [reservationId, JSON.stringify(oldBooking), JSON.stringify(updatedBooking)]
      );

      // 4. Broadcast changes to all dashboards
      this.broadcastBookingUpdated(updatedBooking);

      // 5. Send updated details to customer on WhatsApp (PRD.md Section 4.2 Step 6)
      const changeLogs: string[] = [];
      if (partySize !== undefined && partySize !== oldBooking.party_size) {
        changeLogs.push(`Party size: ${partySize} guests`);
      }
      if (reservationTime !== undefined && new Date(reservationTime).getTime() !== new Date(oldBooking.reservation_time).getTime()) {
        changeLogs.push(`Time: ${new Date(reservationTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
      }
      if (tableId !== undefined && tableId !== oldBooking.table_id) {
        changeLogs.push(`Table changed`);
      }

      const alertMsg = `⚠️ Notice: Your reservation details have been updated by the restaurant:\n${changeLogs.join('\n')}`;
      
      // Enforce the 24h WhatsApp policy check (stubs template fallback if needed)
      await this.notificationService.sendWhatsAppMessage(
        oldBooking.phone_number,
        alertMsg,
        'reservation_update', // Template name for outside-24h delivery
        [oldBooking.name, reservationTime || oldBooking.reservation_time]
      );

      client.emit('booking.edited.success', { reservationId });
    } catch (error) {
      this.logger.error(`Error editing booking: ${error.message}`);
      client.emit('error', { message: 'Failed to edit booking' });
    }
  }
}
