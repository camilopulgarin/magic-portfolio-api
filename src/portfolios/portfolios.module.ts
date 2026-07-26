import { Module } from '@nestjs/common';
import { PORTFOLIOS_REPOSITORY } from '../common/interfaces/portfolio.interfaces';
import { PortfoliosController } from './portfolios.controller';
import { PortfoliosService } from './portfolios.service';
import { PortfoliosRepository } from './repositories/portfolios.repository';

/**
 * Portfolios module - provides portfolio management functionality
 * Uses injection tokens to support Dependency Inversion Principle (DIP)
 */
@Module({
  controllers: [PortfoliosController],
  providers: [
    PortfoliosService,
    {
      provide: PORTFOLIOS_REPOSITORY,
      useClass: PortfoliosRepository,
    },
    // Also provide concrete class for direct injection if needed
    PortfoliosRepository,
  ],
  exports: [PortfoliosService, PORTFOLIOS_REPOSITORY, PortfoliosRepository],
})
export class PortfoliosModule {}
