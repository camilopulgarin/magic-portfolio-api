import { Injectable } from '@nestjs/common';
import type {
  ICreatePortfolio,
  IPortfolio,
  IPortfolioListOptions,
  IPortfolioPaginatedResult,
  IPortfoliosRepository,
  IUpdatePortfolio,
} from '../../common/interfaces/portfolio.interfaces';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Portfolios repository implementation using Prisma
 * Implements IPortfoliosRepository for Dependency Inversion
 * Can be mocked for testing (Liskov Substitution Principle)
 */
@Injectable()
export class PortfoliosRepository implements IPortfoliosRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find a portfolio by its unique ID
   * @param id - Portfolio's UUID
   * @returns Portfolio if found, null otherwise
   */
  async findById(id: string): Promise<IPortfolio | null> {
    return this.prisma.portfolio.findUnique({
      where: { id },
    });
  }

  /**
   * Find a portfolio by its unique ID and verify ownership
   * @param id - Portfolio's UUID
   * @param userId - Owner's UUID
   * @returns Portfolio if found and owned by user, null otherwise
   */
  async findByIdAndUserId(
    id: string,
    userId: string,
  ): Promise<IPortfolio | null> {
    return this.prisma.portfolio.findFirst({
      where: { id, userId },
    });
  }

  /**
   * Find a portfolio by slug for a specific user
   * @param userId - Owner's UUID
   * @param slug - Portfolio's slug
   * @returns Portfolio if found, null otherwise
   */
  async findByUserIdAndSlug(
    userId: string,
    slug: string,
  ): Promise<IPortfolio | null> {
    return this.prisma.portfolio.findUnique({
      where: {
        userId_slug: { userId, slug },
      },
    });
  }

  /**
   * Find all portfolios belonging to a user with pagination
   * @param options - List options including pagination and sorting
   * @returns Paginated result of portfolios
   */
  async findAllByUserId(
    options: IPortfolioListOptions,
  ): Promise<IPortfolioPaginatedResult> {
    const {
      userId,
      page = 1,
      limit = 10,
      orderBy = 'updatedAt',
      order = 'desc',
    } = options;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.portfolio.findMany({
        where: { userId },
        orderBy: { [orderBy]: order },
        skip,
        take: limit,
      }),
      this.prisma.portfolio.count({
        where: { userId },
      }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Create a new portfolio
   * @param data - Portfolio creation data
   * @returns Created portfolio
   */
  async create(data: ICreatePortfolio): Promise<IPortfolio> {
    return this.prisma.portfolio.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        isPublic: data.isPublic ?? false,
        userId: data.userId,
      },
    });
  }

  /**
   * Update an existing portfolio
   * @param id - Portfolio's UUID
   * @param data - Fields to update
   * @returns Updated portfolio
   */
  async update(id: string, data: IUpdatePortfolio): Promise<IPortfolio> {
    return this.prisma.portfolio.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete a portfolio by its ID
   * @param id - Portfolio's UUID
   * @returns True if deleted, false if not found
   */
  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.portfolio.delete({
        where: { id },
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Count portfolios for a specific user
   * @param userId - User's UUID
   * @returns Number of portfolios
   */
  async countByUserId(userId: string): Promise<number> {
    return this.prisma.portfolio.count({
      where: { userId },
    });
  }
}
