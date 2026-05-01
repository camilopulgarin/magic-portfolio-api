import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { RATE_LIMIT } from '../common/constants';
import { OAUTH_STRATEGY_REGISTRY } from '../common/interfaces/oauth.interfaces';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PasswordService } from './services/password.service';
import { TokenService } from './services/token.service';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { OAuthStrategyRegistry } from './strategies/oauth-registry';

/**
 * Auth module - provides authentication functionality
 * Imports UsersModule for repository access
 */
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt-access' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: '15m',
        },
      }),
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: RATE_LIMIT.TTL * 1000,
        limit: RATE_LIMIT.LIMIT,
      },
    ]),
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    PasswordService,
    JwtAccessStrategy,
    JwtRefreshStrategy,
    GoogleStrategy,
    OAuthStrategyRegistry,
    JwtAuthGuard,
    {
      provide: OAUTH_STRATEGY_REGISTRY,
      useExisting: OAuthStrategyRegistry,
    },
  ],
  exports: [AuthService, TokenService, JwtAuthGuard],
})
export class AuthModule {}

// Export guards for use in other modules
export { JwtAuthGuard } from './guards/jwt-auth.guard';
export { JwtRefreshGuard } from './guards/jwt-refresh.guard';
