/**
 * Portfolio-related interfaces following Interface Segregation Principle
 */

/**
 * Portfolio entity as stored in database
 */
export interface IPortfolio {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
}

/**
 * Data required to create a new portfolio
 */
export interface ICreatePortfolio {
  name: string;
  slug: string;
  description?: string;
  isPublic?: boolean;
  userId: string;
}

/**
 * Data for updating an existing portfolio
 */
export interface IUpdatePortfolio {
  name?: string;
  slug?: string;
  description?: string;
  isPublic?: boolean;
}

/**
 * Options for listing portfolios with pagination
 */
export interface IPortfolioListOptions {
  userId: string;
  page?: number;
  limit?: number;
  orderBy?: 'createdAt' | 'updatedAt' | 'name';
  order?: 'asc' | 'desc';
}

/**
 * Paginated result for portfolio listings
 */
export interface IPortfolioPaginatedResult {
  items: IPortfolio[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Portfolio repository interface - abstraction for database operations
 * Following Dependency Inversion Principle (DIP) and Liskov Substitution Principle (LSP)
 */
export interface IPortfoliosRepository {
  /**
   * Find a portfolio by its unique ID
   * @param id - Portfolio's UUID
   * @returns Portfolio if found, null otherwise
   */
  findById(id: string): Promise<IPortfolio | null>;

  /**
   * Find a portfolio by its unique ID and verify ownership
   * @param id - Portfolio's UUID
   * @param userId - Owner's UUID
   * @returns Portfolio if found and owned by user, null otherwise
   */
  findByIdAndUserId(id: string, userId: string): Promise<IPortfolio | null>;

  /**
   * Find a portfolio by slug for a specific user
   * @param userId - Owner's UUID
   * @param slug - Portfolio's slug
   * @returns Portfolio if found, null otherwise
   */
  findByUserIdAndSlug(userId: string, slug: string): Promise<IPortfolio | null>;

  /**
   * Find all portfolios belonging to a user with pagination
   * @param options - List options including pagination and sorting
   * @returns Paginated result of portfolios
   */
  findAllByUserId(
    options: IPortfolioListOptions,
  ): Promise<IPortfolioPaginatedResult>;

  /**
   * Create a new portfolio
   * @param data - Portfolio creation data
   * @returns Created portfolio
   */
  create(data: ICreatePortfolio): Promise<IPortfolio>;

  /**
   * Update an existing portfolio
   * @param id - Portfolio's UUID
   * @param data - Fields to update
   * @returns Updated portfolio
   */
  update(id: string, data: IUpdatePortfolio): Promise<IPortfolio>;

  /**
   * Delete a portfolio by its ID
   * @param id - Portfolio's UUID
   * @returns True if deleted, false if not found
   */
  delete(id: string): Promise<boolean>;

  /**
   * Count portfolios for a specific user
   * @param userId - User's UUID
   * @returns Number of portfolios
   */
  countByUserId(userId: string): Promise<number>;
}

/**
 * Injection token for portfolio repository
 */
export const PORTFOLIOS_REPOSITORY = Symbol('PORTFOLIOS_REPOSITORY');
