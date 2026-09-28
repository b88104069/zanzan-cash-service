import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { DomainError } from '../errors.js';
import type { UserRepository } from '../repositories/UserRepository.js';
import type { User } from '../types.js';

const scrypt = promisify(scryptCallback);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt.toString('hex')}:${derivedKey.toString('hex')}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, keyHex] = stored.split(':');
  if (!saltHex || !keyHex) return false;
  const salt = Buffer.from(saltHex, 'hex');
  const storedKey = Buffer.from(keyHex, 'hex');
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return storedKey.length === derivedKey.length && timingSafeEqual(storedKey, derivedKey);
}

/**
 * Standalone authentication (Gate 3) — replaces `is_user_logged_in()` /
 * `get_current_user_id()`. See docs/architecture/auth-entitlement-abstraction.md.
 * Not WordPress-specific: this is the standalone service's own user store.
 */
export class AuthService {
  constructor(private readonly users: UserRepository) {}

  async register(email: string, password: string): Promise<User> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      throw new DomainError('VALIDATION_REQUIRED_FIELD', 'Email and password are required.');
    }

    const existing = await this.users.findByEmail(normalizedEmail);
    if (existing) {
      throw new DomainError('EMAIL_ALREADY_REGISTERED', 'An account with this email already exists.');
    }

    const passwordHash = await hashPassword(password);
    return this.users.create({ email: normalizedEmail, passwordHash, role: 'member', createdAt: new Date() });
  }

  async login(email: string, password: string): Promise<User> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.users.findByEmail(normalizedEmail);
    if (!user) throw new DomainError('INVALID_CREDENTIALS', 'Invalid email or password.');

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) throw new DomainError('INVALID_CREDENTIALS', 'Invalid email or password.');

    return user;
  }
}
