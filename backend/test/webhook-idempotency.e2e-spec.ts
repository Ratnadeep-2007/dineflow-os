import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as crypto from 'crypto';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/database/database.service';

describe('Webhook Controller Idempotency & Verification (e2e)', () => {
  let app: INestApplication;
  let databaseService: DatabaseService;
  const testSecret = 'meta_app_secret_placeholder';
  const testMessageId = `msg-test-id-${crypto.randomUUID()}`;

  beforeAll(async () => {
    // Override rawBody parser capability for supertest to work
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    databaseService = app.get<DatabaseService>(DatabaseService);
  });

  afterAll(async () => {
    // Clean up test events from database
    await databaseService.query(
      `DELETE FROM webhook_events WHERE meta_message_id = $1`,
      [testMessageId]
    );
    await app.close();
  });

  const getSignatureHeader = (bodyStr: string): string => {
    const hmac = crypto.createHmac('sha256', testSecret);
    const digest = hmac.update(bodyStr).digest('hex');
    return `sha256=${digest}`;
  };

  it('POST /webhook should reject request with missing signature header with 403', async () => {
    const payload = { metaMessageId: testMessageId, eventType: 'messages' };
    
    await request(app.getHttpServer())
      .post('/webhook')
      .send(payload)
      .expect(403);
  });

  it('POST /webhook should reject request with invalid signature header with 403', async () => {
    const payload = { metaMessageId: testMessageId, eventType: 'messages' };
    
    await request(app.getHttpServer())
      .post('/webhook')
      .set('x-hub-signature-256', 'sha256=invalid-signature-hash')
      .send(payload)
      .expect(403);
  });

  it('POST /webhook should accept valid signature, insert metadata, enqueue task, and return 200', async () => {
    const payload = { metaMessageId: testMessageId, eventType: 'messages', content: 'hello' };
    const bodyStr = JSON.stringify(payload);
    const signature = getSignatureHeader(bodyStr);

    const res = await request(app.getHttpServer())
      .post('/webhook')
      .set('x-hub-signature-256', signature)
      .set('Content-Type', 'application/json')
      .send(bodyStr)
      .expect(200);

    expect(res.body).toEqual({
      status: 'enqueued',
      metaMessageId: testMessageId
    });

    // Verify row was inserted into webhook_events table in database
    const dbCheck = await databaseService.query(
      `SELECT processing_status FROM webhook_events WHERE meta_message_id = $1`,
      [testMessageId]
    );
    expect(dbCheck.rowCount).toBe(1);
    expect(['RECEIVED', 'PROCESSED']).toContain(dbCheck.rows[0].processing_status);
  });

  it('POST /webhook should block duplicate metaMessageId, return 200, and not enqueue/re-process', async () => {
    const payload = { metaMessageId: testMessageId, eventType: 'messages', content: 'hello duplicate' };
    const bodyStr = JSON.stringify(payload);
    const signature = getSignatureHeader(bodyStr);

    // Send same webhook payload a second time
    const res = await request(app.getHttpServer())
      .post('/webhook')
      .set('x-hub-signature-256', signature)
      .set('Content-Type', 'application/json')
      .send(bodyStr)
      .expect(200);

    expect(res.body).toEqual({
      status: 'duplicate',
      metaMessageId: testMessageId
    });

    // Verify database still has exactly one record for this message ID
    const dbCheck = await databaseService.query(
      `SELECT COUNT(*)::int as count FROM webhook_events WHERE meta_message_id = $1`,
      [testMessageId]
    );
    expect(dbCheck.rows[0].count).toBe(1);
  });
});
