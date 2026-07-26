import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for portfolio response
 * Represents portfolio data returned to the client
 */
export class PortfolioResponseDto {
  @ApiProperty({
    description: 'Unique identifier of the portfolio',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Name of the portfolio',
    example: 'My Professional Portfolio',
  })
  name: string;

  @ApiProperty({
    description: 'URL-friendly slug for the portfolio',
    example: 'my-professional-portfolio',
  })
  slug: string;

  @ApiPropertyOptional({
    description: 'Description of the portfolio',
    example: 'A showcase of my best work in web development',
  })
  description: string | null;

  @ApiProperty({
    description: 'Whether the portfolio is publicly visible',
    example: false,
  })
  isPublic: boolean;

  @ApiPropertyOptional({
    description: 'Public URL of the portfolio (only if public)',
    example: 'https://magic-portfolio.com/p/johndoe/my-professional-portfolio',
  })
  publicUrl: string | null;

  @ApiProperty({
    description: 'Date when the portfolio was created',
    example: '2024-01-15T10:30:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Date when the portfolio was last updated',
    example: '2024-01-20T14:45:00.000Z',
  })
  updatedAt: Date;
}

/**
 * DTO for paginated portfolio list response
 */
export class PortfolioPaginatedResponseDto {
  @ApiProperty({
    description: 'List of portfolios',
    type: [PortfolioResponseDto],
  })
  items: PortfolioResponseDto[];

  @ApiProperty({
    description: 'Total number of portfolios',
    example: 15,
  })
  total: number;

  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 10,
  })
  limit: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 2,
  })
  totalPages: number;
}

/**
 * Generic API response wrapper for portfolio operations
 */
export class PortfolioApiResponseDto {
  @ApiProperty({
    description: 'Whether the operation was successful',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Response message',
    example: 'Portfolio created successfully',
  })
  message: string;

  @ApiPropertyOptional({
    description: 'Portfolio data',
    type: PortfolioResponseDto,
  })
  data?: PortfolioResponseDto;
}

/**
 * API response wrapper for paginated portfolio list
 */
export class PortfolioListApiResponseDto {
  @ApiProperty({
    description: 'Whether the operation was successful',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Response message',
    example: 'Portfolios retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Paginated portfolio data',
    type: PortfolioPaginatedResponseDto,
  })
  data: PortfolioPaginatedResponseDto;
}
