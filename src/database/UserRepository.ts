import { IStorageEngine, IUserRepository } from './interfaces';
import { UserEntity } from './models';
import { maskPhoneNumber } from '../utils/numberMasker';

export class UserRepository implements IUserRepository {
  private storage: IStorageEngine;
  private readonly COLLECTION = 'users';

  constructor(storage: IStorageEngine) {
    this.storage = storage;
  }

  async findById(id: string): Promise<UserEntity | null> {
    const users = await this.storage.read<UserEntity>(this.COLLECTION);
    return users[id] || null;
  }

  async save(user: UserEntity): Promise<void> {
    const users = await this.storage.read<UserEntity>(this.COLLECTION);
    users[user.id] = user;
    await this.storage.write(this.COLLECTION, users);
  }

  async getOrCreate(id: string, pushName?: string): Promise<UserEntity> {
    const existing = await this.findById(id);
    const now = Date.now();

    if (existing) {
      if (pushName && pushName !== existing.pushName) {
        existing.pushName = pushName;
      }
      existing.lastSeenAt = now;
      await this.save(existing);
      return existing;
    }

    const newUser: UserEntity = {
      id,
      phoneNumber: id.replace(/@.*$/, ''),
      pushName: pushName || maskPhoneNumber(id),
      createdAt: now,
      lastSeenAt: now,
      role: 'user',
    };

    await this.save(newUser);
    return newUser;
  }

  async updateLastSeen(id: string): Promise<void> {
    const user = await this.findById(id);
    if (user) {
      user.lastSeenAt = Date.now();
      await this.save(user);
    }
  }
}
