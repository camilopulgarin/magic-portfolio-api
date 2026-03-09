import { Injectable } from '@nestjs/common';
import type { ISessionsRepository } from '../../common/interfaces/user.interfaces';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Sessions repository implementation using Prisma
 * Handles session persistence for refresh token management
 */
@Injectable()
export class SessionsRepository implements ISessionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new session
   * @param userId - User's UUID
   * @param refreshToken - Hashed refresh token
   * @param expiresAt - Session expiration date
   * @param metadata - Optional session metadata
   * @returns Created session ID
   */
  async create(
    userId: string,
    refreshToken: string,
    expiresAt: Date,
    metadata?: { userAgent?: string; ipAddress?: string },
  ): Promise<string> {
    const session = await this.prisma.session.create({
      data: {
        userId,
        refreshToken,
        expiresAt,
        userAgent: metadata?.userAgent,
        ipAddress: metadata?.ipAddress,
      },
    });
    return session.id;
  }

  /**
   * Find session by refresh token
   * @param refreshToken - Hashed refresh token
   * @returns Session with user data if found
   */
  async findByRefreshToken(
    refreshToken: string,
  ): Promise<{ id: string; userId: string; expiresAt: Date } | null> {
    return this.prisma.session.findUnique({
      where: { refreshToken },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
      },
    });
  }

  /**
   * Delete a session by ID
   * @param id - Session UUID
   */
  async delete(id: string): Promise<void> {
    await this.prisma.session
      .delete({
        where: { id },
      })
      .catch(() => {
        // Session might already be deleted, ignore error
      });
  }

  /**
   * Delete all sessions for a user
   * @param userId - User's UUID
   */
  async deleteAllForUser(userId: string): Promise<void> {
    await this.prisma.session.deleteMany({
      where: { userId },
    });
  }

  /**
   * Update session with new refresh token (rotation)
   * @param id - Session UUID
   * @param refreshToken - New hashed refresh token
   * @param expiresAt - New expiration date
   */
  async updateRefreshToken(
    id: string,
    refreshToken: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.prisma.session.update({
      where: { id },
      data: {
        refreshToken,
        expiresAt,
      },
    });
  }

  /**
   * Clean up expired sessions
   * Can be called by a scheduled job
   */
  async deleteExpired(): Promise<number> {
    const result = await this.prisma.session.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
    return result.count;
  }
}
