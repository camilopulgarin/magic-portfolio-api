import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type {
  IPortfolio,
  IPortfolioPaginatedResult,
  IPortfoliosRepository,
} from '../common/interfaces/portfolio.interfaces';
import { PORTFOLIOS_REPOSITORY } from '../common/interfaces/portfolio.interfaces';
import { CreatePortfolioDto } from './dto/create-portfolio.dto';
import {
  ListPortfoliosDto,
  PortfolioSortField,
  SortOrder,
} from './dto/list-portfolios.dto';
import { UpdatePortfolioDto } from './dto/update-portfolio.dto';
import { PortfoliosService } from './portfolios.service';

describe('PortfoliosService', () => {
  let portfoliosService: PortfoliosService;
  let portfoliosRepository: jest.Mocked<IPortfoliosRepository>;

  // Test data
  const mockUserId = 'user-123';
  const mockPortfolio: IPortfolio = {
    id: 'portfolio-123',
    name: 'My Portfolio',
    slug: 'my-portfolio',
    description: 'A test portfolio',
    isPublic: false,
    userId: mockUserId,
    createdAt: new Date('2024-01-15T10:30:00.000Z'),
    updatedAt: new Date('2024-01-20T14:45:00.000Z'),
  };

  const mockPaginatedResult: IPortfolioPaginatedResult = {
    items: [mockPortfolio],
    total: 1,
    page: 1,
    limit: 10,
    totalPages: 1,
  };

  beforeEach(async () => {
    // Create mocks for all dependencies
    const mockPortfoliosRepository: jest.Mocked<IPortfoliosRepository> = {
      findById: jest.fn(),
      findByIdAndUserId: jest.fn(),
      findByUserIdAndSlug: jest.fn(),
      findAllByUserId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      countByUserId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PortfoliosService,
        {
          provide: PORTFOLIOS_REPOSITORY,
          useValue: mockPortfoliosRepository,
        },
      ],
    }).compile();

    portfoliosService = module.get<PortfoliosService>(PortfoliosService);
    portfoliosRepository = module.get(PORTFOLIOS_REPOSITORY);
  });

  describe('create', () => {
    const createDto: CreatePortfolioDto = {
      name: 'My Portfolio',
      description: 'A test portfolio',
    };

    it('should create a portfolio successfully', async () => {
      portfoliosRepository.findByUserIdAndSlug.mockResolvedValue(null);
      portfoliosRepository.create.mockResolvedValue(mockPortfolio);

      const result = await portfoliosService.create(mockUserId, createDto);

      expect(result).toEqual(mockPortfolio);
      expect(portfoliosRepository.findByUserIdAndSlug).toHaveBeenCalledWith(
        mockUserId,
        'my-portfolio', // Generated slug
      );
      expect(portfoliosRepository.create).toHaveBeenCalledWith({
        name: createDto.name,
        slug: 'my-portfolio',
        description: createDto.description,
        isPublic: undefined,
        userId: mockUserId,
      });
    });

    it('should create a portfolio with custom slug', async () => {
      const dtoWithSlug: CreatePortfolioDto = {
        ...createDto,
        slug: 'custom-slug',
      };

      portfoliosRepository.findByUserIdAndSlug.mockResolvedValue(null);
      portfoliosRepository.create.mockResolvedValue({
        ...mockPortfolio,
        slug: 'custom-slug',
      });

      const result = await portfoliosService.create(mockUserId, dtoWithSlug);

      expect(result.slug).toBe('custom-slug');
      expect(portfoliosRepository.findByUserIdAndSlug).toHaveBeenCalledWith(
        mockUserId,
        'custom-slug',
      );
    });

    it('should throw ConflictException if slug already exists', async () => {
      portfoliosRepository.findByUserIdAndSlug.mockResolvedValue(mockPortfolio);

      await expect(
        portfoliosService.create(mockUserId, createDto),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    const listDto: ListPortfoliosDto = {
      page: 1,
      limit: 10,
      orderBy: PortfolioSortField.UPDATED_AT,
      order: SortOrder.DESC,
    };

    it('should return paginated portfolios', async () => {
      portfoliosRepository.findAllByUserId.mockResolvedValue(
        mockPaginatedResult,
      );

      const result = await portfoliosService.findAll(mockUserId, listDto);

      expect(result).toEqual(mockPaginatedResult);
      expect(portfoliosRepository.findAllByUserId).toHaveBeenCalledWith({
        userId: mockUserId,
        page: 1,
        limit: 10,
        orderBy: PortfolioSortField.UPDATED_AT,
        order: SortOrder.DESC,
      });
    });

    it('should return empty result when no portfolios', async () => {
      const emptyResult: IPortfolioPaginatedResult = {
        items: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      };

      portfoliosRepository.findAllByUserId.mockResolvedValue(emptyResult);

      const result = await portfoliosService.findAll(mockUserId, listDto);

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('findOne', () => {
    it('should return a portfolio when found and owned by user', async () => {
      portfoliosRepository.findById.mockResolvedValue(mockPortfolio);

      const result = await portfoliosService.findOne(
        mockPortfolio.id,
        mockUserId,
      );

      expect(result).toEqual(mockPortfolio);
    });

    it('should throw NotFoundException when portfolio not found', async () => {
      portfoliosRepository.findById.mockResolvedValue(null);

      await expect(
        portfoliosService.findOne('non-existent-id', mockUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user does not own portfolio', async () => {
      portfoliosRepository.findById.mockResolvedValue({
        ...mockPortfolio,
        userId: 'different-user',
      });

      await expect(
        portfoliosService.findOne(mockPortfolio.id, mockUserId),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    const updateDto: UpdatePortfolioDto = {
      name: 'Updated Portfolio',
    };

    it('should update a portfolio successfully', async () => {
      const updatedPortfolio = { ...mockPortfolio, name: 'Updated Portfolio' };

      portfoliosRepository.findByIdAndUserId.mockResolvedValue(mockPortfolio);
      portfoliosRepository.update.mockResolvedValue(updatedPortfolio);

      const result = await portfoliosService.update(
        mockPortfolio.id,
        mockUserId,
        updateDto,
      );

      expect(result.name).toBe('Updated Portfolio');
      expect(portfoliosRepository.update).toHaveBeenCalledWith(
        mockPortfolio.id,
        updateDto,
      );
    });

    it('should throw NotFoundException when portfolio not found', async () => {
      portfoliosRepository.findByIdAndUserId.mockResolvedValue(null);

      await expect(
        portfoliosService.update('non-existent-id', mockUserId, updateDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when new slug already exists', async () => {
      const updateWithSlug: UpdatePortfolioDto = {
        slug: 'existing-slug',
      };

      portfoliosRepository.findByIdAndUserId.mockResolvedValue(mockPortfolio);
      portfoliosRepository.findByUserIdAndSlug.mockResolvedValue({
        ...mockPortfolio,
        id: 'different-portfolio',
        slug: 'existing-slug',
      });

      await expect(
        portfoliosService.update(mockPortfolio.id, mockUserId, updateWithSlug),
      ).rejects.toThrow(ConflictException);
    });

    it('should allow updating with same slug', async () => {
      const updateWithSameSlug: UpdatePortfolioDto = {
        slug: mockPortfolio.slug,
        name: 'Updated Name',
      };

      portfoliosRepository.findByIdAndUserId.mockResolvedValue(mockPortfolio);
      portfoliosRepository.update.mockResolvedValue({
        ...mockPortfolio,
        name: 'Updated Name',
      });

      const result = await portfoliosService.update(
        mockPortfolio.id,
        mockUserId,
        updateWithSameSlug,
      );

      expect(result.name).toBe('Updated Name');
      // Should not check for slug conflict since it's the same
      expect(portfoliosRepository.findByUserIdAndSlug).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should delete a portfolio successfully', async () => {
      portfoliosRepository.findByIdAndUserId.mockResolvedValue(mockPortfolio);
      portfoliosRepository.delete.mockResolvedValue(true);

      await expect(
        portfoliosService.remove(mockPortfolio.id, mockUserId),
      ).resolves.not.toThrow();

      expect(portfoliosRepository.delete).toHaveBeenCalledWith(
        mockPortfolio.id,
      );
    });

    it('should throw NotFoundException when portfolio not found', async () => {
      portfoliosRepository.findByIdAndUserId.mockResolvedValue(null);

      await expect(
        portfoliosService.remove('non-existent-id', mockUserId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getPublicUrl', () => {
    it('should return public URL when portfolio is public', () => {
      const publicPortfolio = { ...mockPortfolio, isPublic: true };
      const username = 'testuser';

      const result = portfoliosService.getPublicUrl(publicPortfolio, username);

      expect(result).toContain(`/p/${username}/${publicPortfolio.slug}`);
    });

    it('should return null when portfolio is not public', () => {
      const privatePortfolio = { ...mockPortfolio, isPublic: false };
      const username = 'testuser';

      const result = portfoliosService.getPublicUrl(privatePortfolio, username);

      expect(result).toBeNull();
    });
  });
});
