import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IJwtPayload } from '../common/interfaces/auth.interfaces';
import {
  CreatePortfolioDto,
  ListPortfoliosDto,
  PortfolioApiResponseDto,
  PortfolioListApiResponseDto,
  PortfolioResponseDto,
  PortfolioSortField,
  SortOrder,
  UpdatePortfolioDto,
} from './dto';
import { PortfoliosService } from './portfolios.service';

/**
 * Request with authenticated JWT user
 */
interface AuthenticatedRequest extends Request {
  user: IJwtPayload;
}

/**
 * Helper to transform portfolio to response DTO
 */
function toPortfolioResponse(
  portfolio: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    isPublic: boolean;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
  },
  publicUrl: string | null,
): PortfolioResponseDto {
  return {
    id: portfolio.id,
    name: portfolio.name,
    slug: portfolio.slug,
    description: portfolio.description,
    isPublic: portfolio.isPublic,
    publicUrl,
    createdAt: portfolio.createdAt,
    updatedAt: portfolio.updatedAt,
  };
}

/**
 * Portfolios controller - handles portfolio CRUD endpoints
 * All endpoints require authentication
 */
@ApiTags('Portfolios')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('portfolios')
export class PortfoliosController {
  constructor(private readonly portfoliosService: PortfoliosService) {}

  /**
   * Create a new portfolio
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new portfolio',
    description:
      'Creates a new portfolio for the authenticated user. If slug is not provided, it will be generated from the name.',
  })
  @ApiBody({ type: CreatePortfolioDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Portfolio successfully created',
    type: PortfolioApiResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'A portfolio with this slug already exists',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User not authenticated',
  })
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() createPortfolioDto: CreatePortfolioDto,
  ): Promise<PortfolioApiResponseDto> {
    const portfolio = await this.portfoliosService.create(
      req.user.sub,
      createPortfolioDto,
    );
    const publicUrl = this.portfoliosService.getPublicUrl(
      portfolio,
      req.user.username,
    );

    return {
      success: true,
      message: 'Portfolio created successfully',
      data: toPortfolioResponse(portfolio, publicUrl),
    };
  }

  /**
   * List all portfolios for the authenticated user
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List all portfolios',
    description:
      'Returns a paginated list of all portfolios belonging to the authenticated user. Sorted by most recently updated by default.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (1-indexed)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of items per page (max 50)',
    example: 10,
  })
  @ApiQuery({
    name: 'orderBy',
    required: false,
    enum: PortfolioSortField,
    description: 'Field to sort by',
  })
  @ApiQuery({
    name: 'order',
    required: false,
    enum: SortOrder,
    description: 'Sort order',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of portfolios retrieved successfully',
    type: PortfolioListApiResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User not authenticated',
  })
  async findAll(
    @Req() req: AuthenticatedRequest,
    @Query() query: ListPortfoliosDto,
  ): Promise<PortfolioListApiResponseDto> {
    const result = await this.portfoliosService.findAll(req.user.sub, query);

    return {
      success: true,
      message:
        result.total > 0
          ? 'Portfolios retrieved successfully'
          : 'No portfolios found',
      data: {
        items: result.items.map((portfolio) =>
          toPortfolioResponse(
            portfolio,
            this.portfoliosService.getPublicUrl(portfolio, req.user.username),
          ),
        ),
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    };
  }

  /**
   * Get a specific portfolio by ID
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get a portfolio by ID',
    description:
      'Returns a specific portfolio belonging to the authenticated user.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Portfolio UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Portfolio retrieved successfully',
    type: PortfolioApiResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Portfolio not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Access denied to this portfolio',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User not authenticated',
  })
  async findOne(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PortfolioApiResponseDto> {
    const portfolio = await this.portfoliosService.findOne(id, req.user.sub);
    const publicUrl = this.portfoliosService.getPublicUrl(
      portfolio,
      req.user.username,
    );

    return {
      success: true,
      message: 'Portfolio retrieved successfully',
      data: toPortfolioResponse(portfolio, publicUrl),
    };
  }

  /**
   * Update a portfolio
   */
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update a portfolio',
    description:
      'Updates a portfolio belonging to the authenticated user. All fields are optional.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Portfolio UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({ type: UpdatePortfolioDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Portfolio updated successfully',
    type: PortfolioApiResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Portfolio not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Access denied to this portfolio',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'A portfolio with this slug already exists',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User not authenticated',
  })
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePortfolioDto: UpdatePortfolioDto,
  ): Promise<PortfolioApiResponseDto> {
    const portfolio = await this.portfoliosService.update(
      id,
      req.user.sub,
      updatePortfolioDto,
    );
    const publicUrl = this.portfoliosService.getPublicUrl(
      portfolio,
      req.user.username,
    );

    return {
      success: true,
      message: 'Portfolio updated successfully',
      data: toPortfolioResponse(portfolio, publicUrl),
    };
  }

  /**
   * Delete a portfolio
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a portfolio',
    description:
      'Deletes a portfolio belonging to the authenticated user. This action cannot be undone.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Portfolio UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Portfolio deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Portfolio not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Access denied to this portfolio',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User not authenticated',
  })
  async remove(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: boolean; message: string }> {
    await this.portfoliosService.remove(id, req.user.sub);

    return {
      success: true,
      message: 'Portfolio deleted successfully',
    };
  }
}
