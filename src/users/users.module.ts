import { Module } from '@nestjs/common';
import { OAUTH_ACCOUNTS_REPOSITORY } from '../common/interfaces/oauth.interfaces';
import {
  SESSIONS_REPOSITORY,
  USERS_REPOSITORY,
} from '../common/interfaces/user.interfaces';
import { OAuthAccountsRepository } from './repositories/oauth-accounts.repository';
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
    // Also provide concrete classes for direct injection if needed
    UsersRepository,
    SessionsRepository,
    OAuthAccountsRepository,
  ],
  exports: [
    USERS_REPOSITORY,
    SESSIONS_REPOSITORY,
    OAUTH_ACCOUNTS_REPOSITORY,
    UsersRepository,
    SessionsRepository,
    OAuthAccountsRepository,
  ],
})
export class UsersModule {}
