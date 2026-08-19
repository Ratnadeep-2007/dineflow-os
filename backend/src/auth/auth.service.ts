import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { HttpService } from '@nestjs/axios';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn: string;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly redisService: RedisService,
    private readonly jwtService: JwtService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService
  ) {
    this.jwtSecret = this.configService.get<string>('JWT_SECRET') || '';
    this.jwtExpiresIn = this.configService.get<string>('JWT_EXPIRES_IN', '15m');
  }

  // Check password against HaveIBeenPwned range API (NIST SP 800-63B guidelines)
  async isPasswordBreached(password: string): Promise<boolean> {
    const sha1 = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
    const prefix = sha1.substring(0, 5);
    const suffix = sha1.substring(5);

    try {
      const url = `https://api.pwnedpasswords.com/range/${prefix}`;
      const response = await firstValueFrom(
        this.httpService.get(url, { headers: { 'User-Agent': 'WhatsApp-Ordering-System' } })
      );
      const data = response.data as string;
      const lines = data.split('\r\n'); // API returns CRLF

      for (const line of lines) {
        const parts = line.split(':');
        if (parts[0] === suffix) {
          return true; // Match found, password has been breached!
        }
      }
      return false;
    } catch (err) {
      this.logger.error(`HaveIBeenPwned API request failed: ${err.message}. Defaulting to safe password.`);
      return false;
    }
  }

  // Register staff member
  async register(username: string, password: string, name: string, role: 'RECEPTIONIST' | 'ADMIN') {
    // 1. Password policy: minimum length check
    if (password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters long');
    }

    // 2. Password policy: NIST breach check
    const breached = await this.isPasswordBreached(password);
    if (breached) {
      throw new BadRequestException('This password has appeared in data leaks and is insecure. Please choose a different password.');
    }

    // 3. Username uniqueness check
    const existing = await this.databaseService.query(
      'SELECT id FROM staff WHERE username = $1',
      [username]
    );
    if (existing.rowCount && existing.rowCount > 0) {
      throw new BadRequestException('Username is already taken');
    }

    // 4. Hash password with bcrypt
    const passwordHash = await bcrypt.hash(password, 12);

    // 5. Save to database
    const result = await this.databaseService.query(
      `INSERT INTO staff (username, password_hash, name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, name, role, created_at`,
      [username, passwordHash, name, role]
    );

    return result.rows[0];
  }

  // Login staff member
  async login(username: string, password: string) {
    // 1. Find user in database
    const userResult = await this.databaseService.query(
      'SELECT id, username, password_hash, name, role FROM staff WHERE username = $1',
      [username]
    );

    if (userResult.rowCount === 0) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const user = userResult.rows[0];

    // 2. Verify password hash
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // 3. Generate session ID / JTI for server-side token revocation
    const jti = crypto.randomUUID();

    // 4. Generate JWT
    const payload = { 
      sub: user.id, 
      username: user.username, 
      role: user.role,
      jti 
    };
    const token = this.jwtService.sign(payload, {
      secret: this.jwtSecret,
      expiresIn: this.jwtExpiresIn as any,
    });

    // 5. Store session in Redis for server-side revocation (expires in 15 minutes / match token expiry)
    // Whitelsiting JTI keys in Redis is a highly performant and secure token revocation method
    const sessionKey = `auth:session:${user.id}:${jti}`;
    await this.redisService.set(sessionKey, 'active', 900); // 15 minutes (900 seconds)

    return {
      accessToken: token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
      }
    };
  }

  // Revoke token / logout
  async logout(userId: string, jti: string) {
    const sessionKey = `auth:session:${userId}:${jti}`;
    await this.redisService.del(sessionKey);
    return { success: true, message: 'Logged out successfully' };
  }

  // Verify if token JTI is still active in Redis
  async isSessionActive(userId: string, jti: string): Promise<boolean> {
    const sessionKey = `auth:session:${userId}:${jti}`;
    const value = await this.redisService.get(sessionKey);
    return value === 'active';
  }
}
