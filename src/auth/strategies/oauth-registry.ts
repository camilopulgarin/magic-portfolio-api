import { Injectable } from '@nestjs/common';
import {
  IOAuthStrategy,
  OAuthProvider,
} from '../../common/interfaces/oauth.interfaces';
import { GoogleMockStrategy } from './google-mock.strategy';

/**
 * OAuth Strategy Registry
 * Allows dynamic registration of OAuth providers
 * Following Open/Closed Principle (OCP) - open for extension, closed for modification
 *
 * To add a new provider:
 * 1. Create a new strategy implementing IOAuthStrategy
 * 2. Register it in the module providers
 * 3. Add it to this registry (or inject via DI)
 */
@Injectable()
export class OAuthStrategyRegistry {
  private readonly strategies: Map<OAuthProvider, IOAuthStrategy> = new Map();

  constructor(private readonly googleMockStrategy: GoogleMockStrategy) {
    // Register default strategies
    this.register(googleMockStrategy);
  }

  /**
   * Register an OAuth strategy
   * @param strategy - Strategy implementing IOAuthStrategy
   */
  register(strategy: IOAuthStrategy): void {
    this.strategies.set(strategy.provider, strategy);
  }

  /**
   * Get a registered strategy by provider name
   * @param provider - OAuth provider name
   * @returns Strategy if registered, undefined otherwise
   */
  get(provider: OAuthProvider): IOAuthStrategy | undefined {
    return this.strategies.get(provider);
  }

  /**
   * Check if a provider is supported
   * @param provider - OAuth provider name
   * @returns True if provider is registered
   */
  isSupported(provider: string): provider is OAuthProvider {
    return this.strategies.has(provider as OAuthProvider);
  }

  /**
   * Get list of supported providers
   * @returns Array of supported provider names
   */
  getSupportedProviders(): OAuthProvider[] {
    return Array.from(this.strategies.keys());
  }
}
