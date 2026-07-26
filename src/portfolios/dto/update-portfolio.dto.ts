import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * DTO for updating an existing portfolio
 * All fields are optional for partial updates
 */
export class UpdatePortfolioDto {
  @ApiPropertyOptional({
    description: 'Name of the portfolio',
    example: 'Updated Portfolio Name',
    minLength: 2,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters long' })
  @MaxLength(100, { message: 'Name must not exceed 100 characters' })
  name?: string;

  @ApiPropertyOptional({
    description:
      'URL-friendly slug for the portfolio. Must be lowercase alphanumeric with hyphens.',
    example: 'updated-portfolio-name',
    minLength: 2,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Slug must be at least 2 characters long' })
  @MaxLength(100, { message: 'Slug must not exceed 100 characters' })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      'Slug must be lowercase alphanumeric with hyphens only (e.g., "my-portfolio")',
  })
  slug?: string;

  @ApiPropertyOptional({
    description: 'Description of the portfolio',
    example: 'Updated description for the portfolio',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Description must not exceed 500 characters' })
  description?: string;

  @ApiPropertyOptional({
    description: 'Whether the portfolio is publicly visible',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
