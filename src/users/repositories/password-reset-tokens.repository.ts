import { Injectable } from '@nestjs/common';
import type {
  IPasswordResetToken,
  IPasswordResetTokensRepository,
} from '../../common/interfaces/user.interfaces';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Prisma implementation of the password-reset token repository
 * Single Responsibility: only persists / retrieves PasswordResetToken records
 * Implements IPasswordResetTokensRepository (Dependency Inversion)
 */
@Injectable()
export class PasswordResetTokensRepository implements IPasswordResetTokensRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<IPasswordResetToken> {
    return this.prisma.passwordResetToken.create({
      data: { userId, tokenHash, expiresAt },
    });
  }

  async findByTokenHash(
    tokenHash: string,
  ): Promise<IPasswordResetToken | null> {
    return this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });
  }

  async markAsUsed(id: string): Promise<void> {
    await this.prisma.passwordResetToken.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.prisma.passwordResetToken.deleteMany({ where: { userId } });
  }
}
