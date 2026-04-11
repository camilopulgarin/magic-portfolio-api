import { Injectable } from '@nestjs/common';
import type {
  ICreateUser,
  IUpdateUser,
  IUser,
  IUsersRepository,
} from '../../common/interfaces/user.interfaces';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Users repository implementation using Prisma
 * Implements IUsersRepository for Dependency Inversion
 * Can be mocked for testing (Liskov Substitution Principle)
 */
@Injectable()
export class UsersRepository implements IUsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find a user by their unique ID
   * @param id - User's UUID
   * @returns User if found, null otherwise
   */
  async findById(id: string): Promise<IUser | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  /**
   * Find a user by their email address
   * @param email - User's email
   * @returns User if found, null otherwise
   */
  async findByEmail(email: string): Promise<IUser | null> {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  /**
   * Find a user by their username
   * @param username - User's username
   * @returns User if found, null otherwise
   */
  async findByUsername(username: string): Promise<IUser | null> {
    return this.prisma.user.findUnique({
      where: { username: username.toLowerCase() },
    });
  }

  /**
   * Create a new user in the database
   * @param data - User creation data
   * @returns Created user
   */
  async create(data: ICreateUser): Promise<IUser> {
    return this.prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash: data.passwordHash,
        fullName: data.fullName,
        username: data.username.toLowerCase(),
        avatarUrl: data.avatarUrl,
        bio: data.bio,
      },
    });
  }

  /**
   * Update an existing user
   * @param id - User's UUID
   * @param data - Fields to update
   * @returns Updated user
   */
  async update(id: string, data: IUpdateUser): Promise<IUser> {
    const updateData: Record<string, unknown> = {};

    if (data.email !== undefined) {
      updateData.email = data.email.toLowerCase();
    }
    if (data.fullName !== undefined) {
      updateData.fullName = data.fullName;
    }
    if (data.username !== undefined) {
      updateData.username = data.username.toLowerCase();
    }
    if (data.avatarUrl !== undefined) {
      updateData.avatarUrl = data.avatarUrl;
    }
    if (data.bio !== undefined) {
      updateData.bio = data.bio;
    }
    if (data.isActive !== undefined) {
      updateData.isActive = data.isActive;
    }
    if (data.isVerified !== undefined) {
      updateData.isVerified = data.isVerified;
    }

    return this.prisma.user.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Find user by email or username for registration validation
   * @param email - Email to check
   * @param username - Username to check
   * @returns User if either email or username exists
   */
  async findByEmailOrUsername(
    email: string,
    username: string,
  ): Promise<IUser | null> {
    return this.prisma.user.findFirst({
      where: {
        OR: [
          { email: email.toLowerCase() },
          { username: username.toLowerCase() },
        ],
      },
    });
  }
}
