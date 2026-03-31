import { DocumentBuilder } from '@nestjs/swagger';

/**
 * Swagger/OpenAPI documentation configuration
 * Centralized configuration following Clean Architecture principles
 */
export const swaggerConfig = new DocumentBuilder()
  .setTitle('Magic Portfolio API')
  .setDescription(
    `
    API documentation for Magic Portfolio.

    ## Features
    - User authentication (JWT-based)
    - OAuth integration
    - Portfolio management

    ## Authentication
    Most endpoints require JWT authentication.
    Use the /auth/login endpoint to obtain a token.
  `,
  )
  .setVersion('1.0')
  .setContact(
    'Magic Portfolio Team',
    'https://magic-portfolio.com',
    'support@magic-portfolio.com',
  )
  .addBearerAuth(
    {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      name: 'Authorization',
      description: 'Enter your JWT token',
      in: 'header',
    },
    'JWT-auth',
  )
  .addTag('Authentication', 'User authentication and authorization endpoints')
  .addTag('Users', 'User management endpoints')
  .build();

/**
 * Swagger setup options
 */
export const swaggerOptions = {
  swaggerOptions: {
    persistAuthorization: true,
    docExpansion: 'none' as const,
    filter: true,
    showRequestDuration: true,
  },
  customSiteTitle: 'Magic Portfolio API Documentation',
};
