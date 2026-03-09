import { Injectable } from '@nestjs/common';
import type {
  IOAuthAccount,
  IOAuthAccountsRepository,
  IOAuthProfile,
  IUpsertOAuthAccount,
} from '../../common/interfaces/oauth.interfaces';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * OAuth accounts repository implementation
 * Handles OAuth account persistence and user linking
 */
@Injectable()
export class OAuthAccountsRepository implements IOAuthAccountsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find OAuth account by provider and provider user ID
   * @param provider - OAuth provider name
   * @param providerUserId - User's ID in provider's system
   * @returns OAuth account with user data if found
   */
  async findByProviderAndId(
    provider: string,
    providerUserId: string,
  ): Promise<(IOAuthAccount & { user: { id: string; email: string } }) | null> {
    return this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerUserId: {
          provider,
          providerUserId,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Create or update OAuth account and associated user
   * Uses transaction to ensure atomicity
   * @param profile - Normalized OAuth profile
   * @returns User ID (existing or newly created)
   */
  async upsertWithUser(profile: IOAuthProfile): Promise<string> {
    return this.prisma.$transaction(async (tx) => {
      // Check if OAuth account already exists
      const existingOAuth = await tx.oAuthAccount.findUnique({
        where: {
          provider_providerUserId: {
            provider: profile.provider,
            providerUserId: profile.providerUserId,
          },
        },
        include: { user: true },
      });

      if (existingOAuth) {
        // Update OAuth tokens
        await tx.oAuthAccount.update({
          where: { id: existingOAuth.id },
          data: {
            accessToken: profile.accessToken,
            refreshToken: profile.refreshToken,
            expiresAt: profile.expiresAt,
          },
        });
        return existingOAuth.userId;
      }

      // Check if user with this email already exists
      const existingUser = await tx.user.findUnique({
        where: { email: profile.email.toLowerCase() },
      });

      if (existingUser) {
        // Link OAuth account to existing user
        await tx.oAuthAccount.create({
          data: {
            provider: profile.provider,
            providerUserId: profile.providerUserId,
            accessToken: profile.accessToken,
            refreshToken: profile.refreshToken,
            expiresAt: profile.expiresAt,
            userId: existingUser.id,
          },
        });
        return existingUser.id;
      }

      // Create new user with OAuth account
      const username = await this.generateUniqueUsername(tx, profile.email);
      const newUser = await tx.user.create({
        data: {
          email: profile.email.toLowerCase(),
          fullName: profile.fullName,
          username,
          avatarUrl: profile.avatarUrl,
          isVerified: true, // OAuth users are auto-verified
          oauthAccounts: {
            create: {
              provider: profile.provider,
              providerUserId: profile.providerUserId,
              accessToken: profile.accessToken,
              refreshToken: profile.refreshToken,
              expiresAt: profile.expiresAt,
            },
          },
        },
      });

      return newUser.id;
    });
  }

  /**
   * Link OAuth account to existing user
   * @param userId - User's UUID
   * @param data - OAuth account data
   */
  async linkToUser(userId: string, data: IUpsertOAuthAccount): Promise<void> {
    await this.prisma.oAuthAccount.upsert({
      where: {
        provider_providerUserId: {
          provider: data.provider,
          providerUserId: data.providerUserId,
        },
      },
      create: {
        provider: data.provider,
        providerUserId: data.providerUserId,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt: data.expiresAt,
        userId,
      },
      update: {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt: data.expiresAt,
      },
    });
  }

  /**
   * Generate a unique username from email
   */
  private async generateUniqueUsername(
    tx: Parameters<Parameters<typeof this.prisma.$transaction>[0]>[0],
    email: string,
  ): Promise<string> {
    const baseUsername = email
      .split('@')[0]
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    let username = baseUsername;
    let counter = 1;

    while (await tx.user.findUnique({ where: { username } })) {
      username = `${baseUsername}${counter}`;
      counter++;
    }

    return username;
  }
}
