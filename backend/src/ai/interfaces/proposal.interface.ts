export interface StructuredProposal {
  intent: 'RESERVE' | 'ORDER' | 'BROWSE' | 'UNKNOWN';
  partySize?: number;
  date?: string; // YYYY-MM-DD
  time?: string; // HH:MM
  menuItems?: Array<{
    name: string;
    quantity: number;
  }>;
  dietaryFilter?: string;
  confidence: number;
  rawQuery: string;
}
