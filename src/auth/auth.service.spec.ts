import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EMAIL_SERVICE } from '../common/interfaces/email.interfaces';
import {
  IOAuthAccountsRepository,
  OAUTH_ACCOUNTS_REPOSITORY,
} from '../common/interfaces/oauth.interfaces';
import {
  IPasswordResetTokensRepository,
  ISessionsRepository,
  IUser,
  IUsersRepository,
  PASSWORD_RESET_TOKENS_REPOSITORY,
  SESSIONS_REPOSITORY,
  USERS_REPOSITORY,
} from '../common/interfaces/user.interfaces';
import { AuthService } from './auth.service';
import { PasswordService } from './services/password.service';
import { TokenService } from './services/token.service';
import { GoogleStrategy } from './strategies/google.strategy';
import { OAuthStrategyRegistry } from './strategies/oauth-registry';

// Minimal mock — avoids the ConfigService dependency in unit tests
const mockGoogleStrategy: Partial<GoogleStrategy> = {
  provider: 'google',
  validate: jest.fn(),
  validateAndGetProfile: jest.fn(),
};

describe('AuthService', () => {
  let authService: AuthService;
  let usersRepository: jest.Mocked<IUsersRepository>;
  let sessionsRepository: jest.Mocked<ISessionsRepository>;
  let oauthAccountsRepository: jest.Mocked<IOAuthAccountsRepository>;
  let tokenService: jest.Mocked<TokenService>;
  let passwordService: jest.Mocked<PasswordService>;

  // Test data
  const mockUser: IUser = {
    id: 'user-123',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    fullName: 'Test User',
    username: 'testuser',
    avatarUrl: null,
    bio: null,
    isActive: true,
    isVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTokens = {
    accessToken: 'access-token-123',
    refreshToken: 'refresh-token-123',
  };

  beforeEach(async () => {
    // Create mocks for all dependencies
    const mockUsersRepository: jest.Mocked<IUsersRepository> = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findByUsername: jest.fn(),
      findByEmailOrUsername: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updatePassword: jest.fn(),
    };

    const mockSessionsRepository: jest.Mocked<ISessionsRepository> = {
      create: jest.fn(),
      findByRefreshToken: jest.fn(),
      delete: jest.fn(),
      deleteAllForUser: jest.fn(),
      updateRefreshToken: jest.fn(),
    };

    const mockOAuthAccountsRepository: jest.Mocked<IOAuthAccountsRepository> = {
      findByProviderAndId: jest.fn(),
      upsertWithUser: jest.fn(),
      linkToUser: jest.fn(),
    };

    const mockPasswordResetTokensRepository: jest.Mocked<IPasswordResetTokensRepository> =
      {
        create: jest.fn(),
        findByTokenHash: jest.fn(),
        markAsUsed: jest.fn(),
        deleteByUserId: jest.fn(),
      };

    const mockEmailService = {
      sendPasswordResetEmail: jest.fn().mockResolvedValue({ success: true }),
    };

    const mockTokenService = {
      generateTokens: jest.fn(),
      generateAccessToken: jest.fn(),
      generateRefreshToken: jest.fn(),
      verifyAccessToken: jest.fn(),
      verifyRefreshToken: jest.fn(),
      getRefreshTokenExpiryDate: jest.fn(),
    };

    const mockPasswordService = {
      hash: jest.fn(),
      compare: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: GoogleStrategy, useValue: mockGoogleStrategy },
        OAuthStrategyRegistry,
        {
          provide: USERS_REPOSITORY,
          useValue: mockUsersRepository,
        },
        {
          provide: SESSIONS_REPOSITORY,
          useValue: mockSessionsRepository,
        },
        {
          provide: OAUTH_ACCOUNTS_REPOSITORY,
          useValue: mockOAuthAccountsRepository,
        },
        {
          provide: PASSWORD_RESET_TOKENS_REPOSITORY,
          useValue: mockPasswordResetTokensRepository,
        },
        {
          provide: EMAIL_SERVICE,
          useValue: mockEmailService,
        },
        {
          provide: TokenService,
          useValue: mockTokenService,
        },
        {
          provide: PasswordService,
          useValue: mockPasswordService,
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    usersRepository = module.get(USERS_REPOSITORY);
    sessionsRepository = module.get(SESSIONS_REPOSITORY);
    oauthAccountsRepository = module.get(OAUTH_ACCOUNTS_REPOSITORY);
    tokenService = module.get(TokenService);
    passwordService = module.get(PasswordService);
  });

  describe('register', () => {
    const registerDto = {
      email: 'new@example.com',
      password: 'SecurePass123',
      fullName: 'New User',
      username: 'newuser',
    };

    it('should successfully register a new user', async () => {
      // Arrange
      usersRepository.findByEmailOrUsername.mockResolvedValue(null);
      passwordService.hash.mockResolvedValue('hashed-password');
      usersRepository.create.mockResolvedValue({
        ...mockUser,
        email: registerDto.email,
        username: registerDto.username,
        fullName: registerDto.fullName,
      });
      sessionsRepository.create.mockResolvedValue('session-123');
      tokenService.getRefreshTokenExpiryDate.mockReturnValue(new Date());
      tokenService.generateTokens.mockResolvedValue(mockTokens);

      // Act
      const result = await authService.register(registerDto);

      // Assert
      expect(result.user.email).toBe(registerDto.email);
      expect(result.tokens).toEqual(mockTokens);
      expect(passwordService.hash).toHaveBeenCalledWith(registerDto.password);
      expect(usersRepository.create).toHaveBeenCalledWith({
        email: registerDto.email,
        passwordHash: 'hashed-password',
        fullName: registerDto.fullName,
        username: registerDto.username,
      });
    });

    it('should throw ConflictException if email already exists', async () => {
      // Arrange
      usersRepository.findByEmailOrUsername.mockResolvedValue({
        ...mockUser,
        email: registerDto.email.toLowerCase(),
      });

      // Act & Assert
      await expect(authService.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(authService.register(registerDto)).rejects.toThrow(
        'Email already registered',
      );
    });

    it('should throw ConflictException if username already exists', async () => {
      // Arrange
      usersRepository.findByEmailOrUsername.mockResolvedValue({
        ...mockUser,
        email: 'different@example.com',
        username: registerDto.username.toLowerCase(),
      });

      // Act & Assert
      await expect(authService.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(authService.register(registerDto)).rejects.toThrow(
        'Username already taken',
      );
    });
  });

  describe('login', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'SecurePass123',
    };

    it('should successfully login with valid credentials', async () => {
      // Arrange
      usersRepository.findByEmail.mockResolvedValue(mockUser);
      passwordService.compare.mockResolvedValue(true);
      sessionsRepository.create.mockResolvedValue('session-123');
      tokenService.getRefreshTokenExpiryDate.mockReturnValue(new Date());
      tokenService.generateTokens.mockResolvedValue(mockTokens);

      // Act
      const result = await authService.login(loginDto);

      // Assert
      expect(result.user.email).toBe(mockUser.email);
      expect(result.tokens).toEqual(mockTokens);
      expect(passwordService.compare).toHaveBeenCalledWith(
        loginDto.password,
        mockUser.passwordHash,
      );
    });

    it('should throw UnauthorizedException if user not found', async () => {
      // Arrange
      usersRepository.findByEmail.mockResolvedValue(null);

      // Act & Assert
      await expect(authService.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(authService.login(loginDto)).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('should throw UnauthorizedException if password is invalid', async () => {
      // Arrange
      usersRepository.findByEmail.mockResolvedValue(mockUser);
      passwordService.compare.mockResolvedValue(false);

      // Act & Assert
      await expect(authService.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(authService.login(loginDto)).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('should throw UnauthorizedException if user is inactive', async () => {
      // Arrange
      usersRepository.findByEmail.mockResolvedValue({
        ...mockUser,
        isActive: false,
      });

      // Act & Assert
      await expect(authService.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(authService.login(loginDto)).rejects.toThrow(
        'Account is disabled',
      );
    });

    it('should throw UnauthorizedException if user has no password (OAuth only)', async () => {
      // Arrange
      usersRepository.findByEmail.mockResolvedValue({
        ...mockUser,
        passwordHash: null,
      });

      // Act & Assert
      await expect(authService.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('refreshTokens', () => {
    it('should successfully refresh tokens', async () => {
      // Arrange
      usersRepository.findById.mockResolvedValue(mockUser);
      tokenService.generateTokens.mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
      tokenService.getRefreshTokenExpiryDate.mockReturnValue(new Date());

      // Act
      const result = await authService.refreshTokens(
        'user-123',
        'session-123',
        'old-refresh-token',
      );

      // Assert
      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
      expect(sessionsRepository.updateRefreshToken).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if user not found', async () => {
      // Arrange
      usersRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(
        authService.refreshTokens('user-123', 'session-123', 'old-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user is inactive', async () => {
      // Arrange
      usersRepository.findById.mockResolvedValue({
        ...mockUser,
        isActive: false,
      });

      // Act & Assert
      await expect(
        authService.refreshTokens('user-123', 'session-123', 'old-token'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should delete session on logout', async () => {
      // Arrange
      sessionsRepository.findByRefreshToken.mockResolvedValue({
        id: 'session-123',
        userId: 'user-123',
        expiresAt: new Date(),
      });

      // Act
      await authService.logout('refresh-token');

      // Assert
      expect(sessionsRepository.delete).toHaveBeenCalledWith('session-123');
    });

    it('should not throw if session not found', async () => {
      // Arrange
      sessionsRepository.findByRefreshToken.mockResolvedValue(null);

      // Act & Assert
      await expect(authService.logout('invalid-token')).resolves.not.toThrow();
    });
  });

  describe('getMe', () => {
    it('should return user public profile', async () => {
      // Arrange
      usersRepository.findById.mockResolvedValue(mockUser);

      // Act
      const result = await authService.getMe('user-123');

      // Assert
      expect(result.id).toBe(mockUser.id);
      expect(result.email).toBe(mockUser.email);
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should throw UnauthorizedException if user not found', async () => {
      // Arrange
      usersRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(authService.getMe('invalid-id')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('authenticateOAuth', () => {
    const mockOAuthToken = JSON.stringify({
      sub: 'google-123',
      email: 'oauth@example.com',
      name: 'OAuth User',
      picture: 'https://example.com/avatar.jpg',
    });

    it('should authenticate user via OAuth', async () => {
      // Arrange
      oauthAccountsRepository.upsertWithUser.mockResolvedValue('user-123');
      usersRepository.findById.mockResolvedValue({
        ...mockUser,
        email: 'oauth@example.com',
        fullName: 'OAuth User',
      });
      sessionsRepository.create.mockResolvedValue('session-123');
      tokenService.getRefreshTokenExpiryDate.mockReturnValue(new Date());
      tokenService.generateTokens.mockResolvedValue(mockTokens);

      // Act
      const result = await authService.authenticateOAuth(
        'google',
        mockOAuthToken,
      );

      // Assert
      expect(result.user.email).toBe('oauth@example.com');
      expect(result.tokens).toEqual(mockTokens);
    });

    it('should throw BadRequestException for unsupported provider', async () => {
      // Act & Assert
      await expect(
        authService.authenticateOAuth('unsupported', 'token'),
      ).rejects.toThrow('not supported');
    });
  });
});
