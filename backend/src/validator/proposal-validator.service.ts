import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { StructuredProposal } from '../ai/interfaces/proposal.interface';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  validatedData?: {
    intent: 'RESERVE' | 'ORDER' | 'BROWSE' | 'UNKNOWN';
    partySize?: number;
    reservationTime?: Date;
    menuItems?: Array<{
      menuItemId: string;
      name: string;
      quantity: number;
      unitPrice: number;
    }>;
    dietaryFilter?: string;
  };
}

@Injectable()
export class ProposalValidatorService {
  private readonly logger = new Logger(ProposalValidatorService.name);
  private readonly confidenceThreshold = 0.70; // Configurable threshold (architecture.md Section 5)

  constructor(private readonly databaseService: DatabaseService) {}

  async validateProposal(proposal: StructuredProposal): Promise<ValidationResult> {
    const errors: string[] = [];
    this.logger.log(`Validating AI proposal for intent: ${proposal.intent}`);

    // 1. Verify confidence threshold
    if (proposal.confidence < this.confidenceThreshold) {
      errors.push(`Confidence score (${proposal.confidence}) is below threshold (${this.confidenceThreshold})`);
      return { isValid: false, errors };
    }

    const validatedData: any = {
      intent: proposal.intent,
      dietaryFilter: proposal.dietaryFilter,
    };

    // 2. Validate Party Size bounds
    if (proposal.partySize !== undefined) {
      if (proposal.partySize <= 0 || proposal.partySize > 20) {
        errors.push(`Party size (${proposal.partySize}) is out of realistic bounds (1-20)`);
      } else {
        validatedData.partySize = proposal.partySize;
      }
    }

    // 3. Validate Date & Time for Reservation
    if (proposal.intent === 'RESERVE') {
      if (!proposal.date || !proposal.time) {
        errors.push('Missing date or time parameters for table reservation');
      } else {
        const dateTimeStr = `${proposal.date}T${proposal.time}:00`;
        const resTime = new Date(dateTimeStr);

        if (isNaN(resTime.getTime())) {
          errors.push(`Failed to parse reservation date/time: ${dateTimeStr}`);
        } else {
          const now = new Date();
          // Check if slot is in the future
          if (resTime <= now) {
            errors.push('Reservation time must be a real future slot');
          }

          // Check restaurant hours: 11:00 AM (11:00) to 11:00 PM (23:00)
          const hours = resTime.getHours();
          if (hours < 11 || hours >= 23) {
            errors.push('Reservation must be within restaurant operating hours (11:00 AM to 11:00 PM)');
          }

          validatedData.reservationTime = resTime;
        }
      }
    }

    // 4. Validate Menu Items existence & stock status (if ORDER intent)
    if (proposal.intent === 'ORDER') {
      if (!proposal.menuItems || proposal.menuItems.length === 0) {
        errors.push('No menu items specified for order');
      } else {
        const validatedItems: any[] = [];
        for (const item of proposal.menuItems) {
          // Query MENU_ITEMS table (created in Phase 1)
          const dbItem = await this.databaseService.query(
            `SELECT id, name, price, stock_status FROM menu_items WHERE LOWER(name) = LOWER($1)`,
            [item.name]
          );

          if (dbItem.rowCount === 0) {
            errors.push(`Item "${item.name}" does not exist in the menu`);
          } else {
            const menuItem = dbItem.rows[0];
            // Check if item is 86'd / out of stock
            if (menuItem.stock_status !== 'IN_STOCK') {
              errors.push(`Item "${menuItem.name}" is currently out of stock`);
            } else {
              validatedItems.push({
                menuItemId: menuItem.id,
                name: menuItem.name,
                quantity: item.quantity,
                unitPrice: parseFloat(menuItem.price),
              });
            }
          }
        }
        validatedData.menuItems = validatedItems;
      }
    }

    const isValid = errors.length === 0;
    return {
      isValid,
      errors,
      validatedData: isValid ? validatedData : undefined,
    };
  }
}
