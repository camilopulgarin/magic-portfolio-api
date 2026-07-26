import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type {
  IPortfolio,
  IPortfolioPaginatedResult,
  IPortfoliosRepository,
} from '../common/interfaces/portfolio.interfaces';
import { PORTFOLIOS_REPOSITORY } from '../common/interfaces/portfolio.interfaces';
import { CreatePortfolioDto } from './dto/create-portfolio.dto';
import { ListPortfoliosDto } from './dto/list-portfolios.dto';
import { UpdatePortfolioDto } from './dto/update-portfolio.dto';

/**
 * Helper function to generate a slug from a name
 * @param name - Portfolio name to convert to slug
 * @returns URL-friendly slug
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-'); // Replace multiple hyphens with single
}

/**
 * Portfolios service - orchestrates portfolio operations
 * Single Responsibility: Coordinates portfolio CRUD operations
 * Depends on abstractions (interfaces) not implementations (DIP)
 */
@Injectable()
export class PortfoliosService {
  private readonly logger = new Logger(PortfoliosService.name);

  constructor(
    @Inject(PORTFOLIOS_REPOSITORY)
    private readonly portfoliosRepository: IPortfoliosRepository,
  ) {}

  /**
   * Create a new portfolio for a user
   * @param userId - Owner's UUID
   * @param dto - Portfolio creation data
   * @returns Created portfolio
   * @throws ConflictException if slug already exists for user
   */
  async create(userId: string, dto: CreatePortfolioDto): Promise<IPortfolio> {
    // Generate slug from name if not provided
    const slug = dto.slug || generateSlug(dto.name);

    // Check if slug already exists for this user
    const existingPortfolio =
      await this.portfoliosRepository.findByUserIdAndSlug(userId, slug);
    if (existingPortfolio) {
      throw new ConflictException('A portfolio with this slug already exists');
    }

    const portfolio = await this.portfoliosRepository.create({
      name: dto.name,
      slug,
      description: dto.description,
      isPublic: dto.isPublic,
      userId,
    });

    this.logger.log(`Portfolio created: ${portfolio.id} for user: ${userId}`);
    return portfolio;
  }

  /**
   * List all portfolios for a user with pagination
   * @param userId - Owner's UUID
   * @param query - Pagination and sorting options
   * @returns Paginated list of portfolios
   */
  async findAll(
    userId: string,
    query: ListPortfoliosDto,
  ): Promise<IPortfolioPaginatedResult> {
    return this.portfoliosRepository.findAllByUserId({
      userId,
      page: query.page,
      limit: query.limit,
      orderBy: query.orderBy,
      order: query.order,
    });
  }

  /**
   * Find a portfolio by ID
   * @param id - Portfolio's UUID
   * @param userId - Owner's UUID for ownership verification
   * @returns Portfolio if found and owned by user
   * @throws NotFoundException if portfolio not found
   * @throws ForbiddenException if user doesn't own the portfolio
   */
  async findOne(id: string, userId: string): Promise<IPortfolio> {
    const portfolio = await this.portfoliosRepository.findById(id);

    if (!portfolio) {
      throw new NotFoundException('Portfolio not found');
    }

    if (portfolio.userId !== userId) {
      throw new ForbiddenException('You do not have access to this portfolio');
    }

    return portfolio;
  }

  /**
   * Update a portfolio
   * @param id - Portfolio's UUID
   * @param userId - Owner's UUID for ownership verification
   * @param dto - Update data
   * @returns Updated portfolio
   * @throws NotFoundException if portfolio not found
   * @throws ForbiddenException if user doesn't own the portfolio
   * @throws ConflictException if new slug already exists for user
   */
  async update(
    id: string,
    userId: string,
    dto: UpdatePortfolioDto,
  ): Promise<IPortfolio> {
    // Verify ownership
    const portfolio = await this.portfoliosRepository.findByIdAndUserId(
      id,
      userId,
    );

    if (!portfolio) {
      throw new NotFoundException('Portfolio not found');
    }

    // If slug is being changed, check for conflicts
    if (dto.slug && dto.slug !== portfolio.slug) {
      const existingPortfolio =
        await this.portfoliosRepository.findByUserIdAndSlug(userId, dto.slug);
      if (existingPortfolio) {
        throw new ConflictException(
          'A portfolio with this slug already exists',
        );
      }
    }

    const updatedPortfolio = await this.portfoliosRepository.update(id, dto);
    this.logger.log(`Portfolio updated: ${id}`);

    return updatedPortfolio;
  }

  /**
   * Delete a portfolio
   * @param id - Portfolio's UUID
   * @param userId - Owner's UUID for ownership verification
   * @throws NotFoundException if portfolio not found
   * @throws ForbiddenException if user doesn't own the portfolio
   */
  async remove(id: string, userId: string): Promise<void> {
    // Verify ownership
    const portfolio = await this.portfoliosRepository.findByIdAndUserId(
      id,
      userId,
    );

    if (!portfolio) {
      throw new NotFoundException('Portfolio not found');
    }

    await this.portfoliosRepository.delete(id);
    this.logger.log(`Portfolio deleted: ${id}`);
  }

  /**
   * Get the public URL for a portfolio
   * @param portfolio - Portfolio object
   * @param username - Owner's username
   * @returns Public URL or null if not public
   */
  getPublicUrl(portfolio: IPortfolio, username: string): string | null {
    if (!portfolio.isPublic) {
      return null;
    }

    const baseUrl = process.env.PUBLIC_PORTFOLIO_URL || 'http://localhost:3001';
    return `${baseUrl}/p/${username}/${portfolio.slug}`;
  }
}
