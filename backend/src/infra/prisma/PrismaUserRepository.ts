import type { PrismaClient } from '@prisma/client';
import type { UserRepository } from '../../domain/repositories/UserRepository.js';
import type { User } from '../../domain/types.js';

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(user: Omit<User, 'id' | 'createdAt'> & { createdAt: Date }): Promise<User> {
    return this.db.user.create({ data: user });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { email } });
  }

  async findById(userId: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { id: userId } });
  }
}
