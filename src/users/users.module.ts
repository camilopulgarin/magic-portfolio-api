import { Module } from '@nestjs/common';
import { OAUTH_ACCOUNTS_REPOSITORY } from '../common/interfaces/oauth.interfaces';
import {
  PASSWORD_RESET_TOKENS_REPOSITORY,
  SESSIONS_REPOSITORY,
  USERS_REPOSITORY,
} from '../common/interfaces/user.interfaces';
import { OAuthAccountsRepository } from './repositories/oauth-accounts.repository';
import { PasswordResetTokensRepository } from './repositories/password-reset-tokens.repository';
import { SessionsRepository } from './repositories/sessions.repository';
import { UsersRepository } from './repositories/users.repository';

/**
 * Users module - provides user-related repositories
 * Uses injection tokens to support Dependency Inversion Principle (DIP)
 */
@Module({
  providers: [
    {
      provide: USERS_REPOSITORY,
      useClass: UsersRepository,
    },
    {
      provide: SESSIONS_REPOSITORY,
      useClass: SessionsRepository,
    },
    {
      provide: OAUTH_ACCOUNTS_REPOSITORY,
      useClass: OAuthAccountsRepository,
    },
    {
      provide: PASSWORD_RESET_TOKENS_REPOSITORY,
      useClass: PasswordResetTokensRepository,
    },
    // Also provide concrete classes for direct injection if needed
    UsersRepository,
    SessionsRepository,
    OAuthAccountsRepository,
    PasswordResetTokensRepository,
  ],
  exports: [
    USERS_REPOSITORY,
    SESSIONS_REPOSITORY,
    OAUTH_ACCOUNTS_REPOSITORY,
    PASSWORD_RESET_TOKENS_REPOSITORY,
    UsersRepository,
    SessionsRepository,
    OAuthAccountsRepository,
    PasswordResetTokensRepository,
  ],
})
export class UsersModule {}
