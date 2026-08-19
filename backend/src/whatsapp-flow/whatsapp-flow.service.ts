import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import { AiService } from '../ai/ai.service';
import { ProposalValidatorService } from '../validator/proposal-validator.service';
import { NotificationService } from '../notification/notification.service';
import { ReservationsGateway } from '../websocket/reservations.gateway';

// Define Table ID Identification Method as a configuration flag (Open Decision placeholder)
// PRD.md Section 4.2: Open decision between manual table number entry vs. QR-code auto-detect.
export const TABLE_ID_METHOD = 'QR_AUTO_DETECT'; // Options: 'QR_AUTO_DETECT' | 'MANUAL_ENTRY'

@Injectable()
export class WhatsappFlowService {
  private readonly logger = new Logger(WhatsappFlowService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly redisService: RedisService,
    private readonly aiService: AiService,
    private readonly validatorService: ProposalValidatorService,
    private readonly notificationService: NotificationService,
    private readonly reservationsGateway: ReservationsGateway
  ) {}

  // Entry point for inbound WhatsApp webhooks
  async handleInboundMessage(phone: string, text: string) {
    this.logger.log(`Handling message from ${phone}: "${text}"`);
    
    // 1. Record message timestamp for WhatsApp 24h policy window tracking (architecture.md Section 6)
    await this.notificationService.recordInboundMessage(phone);

    // 2. Fetch or initialize user session state from Redis
    const sessionKey = `user:flow_state:${phone}`;
    let state = await this.redisService.get(sessionKey);
    if (!state) {
      state = 'WELCOME';
      await this.redisService.set(sessionKey, state, 1800); // 30 minute session expiry
    }

    // 3. Process according to State Machine (ui-design.md Section 2.3)
    await this.processStateTransition(phone, state, text);
  }

  private async processStateTransition(phone: string, state: string, text: string) {
    const sessionKey = `user:flow_state:${phone}`;
    const dataKey = `user:flow_data:${phone}`;

    switch (state) {
      case 'WELCOME':
        // State 0 Welcome Prompt
        if (text === '1' || text.toLowerCase().includes('dine in')) {
          await this.redisService.set(sessionKey, 'DINE_IN_CHOICE', 1800);
          await this.notificationService.sendWhatsAppMessage(
            phone,
            `🍽️ Dine In:\nWould you like to reserve a table for later, or order now at your table?\n\nRespond with "1" for [Reserve Table] or "2" for [Order Now].`
          );
        } else if (text === '2' || text.toLowerCase().includes('take away')) {
          await this.redisService.set(sessionKey, 'ORDERING', 1800);
          await this.redisService.set(dataKey, JSON.stringify({ orderType: 'TAKEAWAY' }), 1800);
          await this.notificationService.sendWhatsAppMessage(
            phone,
            `🛍️ Take Away:\nMenu is loaded! What would you like to order? (e.g. "Add 1 Paneer Tikka")`
          );
        } else if (text === '3' || text.toLowerCase().includes('delivery')) {
          await this.redisService.set(sessionKey, 'DELIVERY_ADDRESS', 1800);
          await this.notificationService.sendWhatsAppMessage(
            phone,
            `🛵 Delivery:\nPlease input your delivery address:`
          );
        } else if (text === '4' || text.toLowerCase().includes('browse')) {
          await this.redisService.set(sessionKey, 'ORDERING', 1800);
          await this.redisService.set(dataKey, JSON.stringify({ orderType: 'BROWSING' }), 1800);
          await this.notificationService.sendWhatsAppMessage(
            phone,
            `📖 Browsing Menu:\nFeel free to explore our items! Type what you want to add, and we'll ask for order type at checkout.`
          );
        } else {
          // Default greeting
          await this.notificationService.sendWhatsAppMessage(
            phone,
            `Hello! Welcome to our restaurant. How can we help you today?\n\n1. 🍽️ Dine In\n2. 🛍️ Take Away\n3. 🛵 Delivery\n4. 📖 Browse Menu`
          );
        }
        break;

      case 'DINE_IN_CHOICE':
        if (text === '1' || text.toLowerCase().includes('reserve')) {
          await this.redisService.set(sessionKey, 'RESERVE_PARTY_SIZE', 1800);
          await this.notificationService.sendWhatsAppMessage(
            phone,
            `How many guests will be joining us? (Respond with a number, e.g. "4")`
          );
        } else if (text === '2' || text.toLowerCase().includes('order now')) {
          // Open Decision Table ID selection (PRD.md Section 4.2)
          if (TABLE_ID_METHOD === 'QR_AUTO_DETECT') {
            this.logger.log(`Table ID auto-detected via QR code mock (Table 5)`);
            await this.redisService.set(sessionKey, 'ORDERING', 1800);
            await this.redisService.set(dataKey, JSON.stringify({ orderType: 'DINE_IN', tableId: 'Table 5' }), 1800);
            await this.notificationService.sendWhatsAppMessage(
              phone,
              `Seated at Table 5. Menu is loaded! Respond with items you would like to order.`
            );
          } else {
            // MANUAL ENTRY placeholder
            await this.redisService.set(sessionKey, 'ORDER_TABLE_ENTRY', 1800);
            await this.notificationService.sendWhatsAppMessage(
              phone,
              `Please enter your Table Number:`
            );
          }
        } else {
          await this.notificationService.sendWhatsAppMessage(
            phone,
            `Invalid option. Respond with "1" to Reserve a Table, or "2" to Order Now.`
          );
        }
        break;

      case 'RESERVE_PARTY_SIZE':
        const partySize = parseInt(text, 10);
        if (isNaN(partySize) || partySize <= 0 || partySize > 20) {
          await this.notificationService.sendWhatsAppMessage(
            phone,
            `Please enter a valid number of guests between 1 and 20 (e.g. "4").`
          );
        } else {
          await this.redisService.set(dataKey, JSON.stringify({ partySize }), 1800);
          await this.redisService.set(sessionKey, 'RESERVE_DATE_TIME', 1800);
          await this.notificationService.sendWhatsAppMessage(
            phone,
            `What date and time would you like to book for? (e.g. "Aug 10 at 7:30 PM" or "tonight at 8")`
          );
        }
        break;

      case 'RESERVE_DATE_TIME':
        const savedDataStr = await this.redisService.get(dataKey);
        const savedData = savedDataStr ? JSON.parse(savedDataStr) : {};

        // 1. Send input to Gemini NLU to extract structured date/time proposal (Phase 3)
        // Gemini has NO database write access. Bounded strictly to returning proposal
        const proposal = await this.aiService.parseMessage(phone, text);
        proposal.intent = 'RESERVE'; // Force intent
        proposal.partySize = savedData.partySize; // Hydrate party size

        // 2. Validate proposal using deterministic logic (Phase 3 ProposalValidator)
        // Checks operating hours and realistic bounds before writes
        const validation = await this.validatorService.validateProposal(proposal);

        if (!validation.isValid) {
          this.logger.warn(`AI proposal failed validation: ${validation.errors.join(', ')}`);
          await this.notificationService.sendWhatsAppMessage(
            phone,
            `We couldn't book that slot: ${validation.errors[0] || 'Invalid slot'}. Please suggest another date and time:`
          );
          return;
        }

        const validDetails = validation.validatedData!;

        // 3. Create/Fetch user in database
        let userResult = await this.databaseService.query(
          `SELECT id FROM users WHERE phone_number = $1`,
          [phone]
        );
        let userId: string;
        if (userResult.rowCount === 0) {
          const insertUser = await this.databaseService.query(
            `INSERT INTO users (phone_number, name) VALUES ($1, $2) RETURNING id`,
            [phone, `Guest_${phone.substring(phone.length - 4)}`]
          );
          userId = insertUser.rows[0].id;
        } else {
          userId = userResult.rows[0].id;
        }

        // 4. Create PENDING reservation record in Postgres (PRD.md Section 4.2 Step 2)
        const reservationResult = await this.databaseService.query(
          `INSERT INTO reservations (user_id, party_size, reservation_time, status, source)
           VALUES ($1, $2, $3, 'PENDING', 'WHATSAPP')
           RETURNING id, user_id, party_size, reservation_time, status, source, created_at`,
          [userId, validDetails.partySize, validDetails.reservationTime]
        );
        const newBooking = reservationResult.rows[0];

        // 5. Broadcast real-time event "booking.created" to dashboard (architecture.md Section 9)
        this.reservationsGateway.broadcastBookingCreated({
          ...newBooking,
          phone_number: phone,
          name: `Guest_${phone.substring(phone.length - 4)}`,
        });

        // 6. Notify customer that booking is queued and wait for receptionist
        await this.redisService.set(sessionKey, 'AWAITING_APPROVAL', 1800);
        await this.notificationService.sendWhatsAppMessage(
          phone,
          `Thanks! We have queued your request for a table of ${validDetails.partySize} on ${validDetails.reservationTime?.toLocaleDateString()} at ${validDetails.reservationTime?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. We are checking table availability with the receptionist. Hold on!`
        );
        break;

      case 'AWAITING_APPROVAL':
        await this.notificationService.sendWhatsAppMessage(
          phone,
          `Your reservation is still pending confirmation by the receptionist. We'll alert you the moment it is confirmed!`
        );
        break;

      case 'ORDERING':
        // Placeholder ordering flow (shared menu engine placeholder)
        await this.notificationService.sendWhatsAppMessage(
          phone,
          `Your order has been logged! Type "Checkout" to complete payment, or keep adding items.`
        );
        break;

      default:
        await this.redisService.set(sessionKey, 'WELCOME', 1800);
        await this.notificationService.sendWhatsAppMessage(
          phone,
          `Session reset. How can we help you today?\n\n1. 🍽️ Dine In\n2. 🛍️ Take Away\n3. 🛵 Delivery\n4. 📖 Browse Menu`
        );
    }
  }
}
