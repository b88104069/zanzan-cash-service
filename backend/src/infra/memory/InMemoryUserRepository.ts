import type { UserRepository } from '../../domain/repositories/UserRepository.js';
import type { User } from '../../domain/types.js';
import { generateId, InMemoryDatabase } from './InMemoryDatabase.js';

export class InMemoryUserRepository implements UserRepository {
  constructor(private readonly db: InMemoryDatabase) {}

  async create(user: Omit<User, 'id' | 'createdAt'> & { createdAt: Date }): Promise<User> {
    const row: User = { ...user, id: generateId('user') };
    this.db.users.set(row.id, row);
    return row;
  }

  async findByEmail(email: string): Promise<User | null> {
    for (const user of this.db.users.values()) {
      if (user.email === email) return user;
    }
    return null;
  }

  async findById(userId: string): Promise<User | null> {
    return this.db.users.get(userId) ?? null;
  }
}
