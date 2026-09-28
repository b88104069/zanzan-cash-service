import type { User } from '../types.js';

export interface UserRepository {
  create(user: Omit<User, 'id' | 'createdAt'> & { createdAt: Date }): Promise<User>;
  findByEmail(email: string): Promise<User | null>;
  findById(userId: string): Promise<User | null>;
}
