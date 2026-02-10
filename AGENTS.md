# AGENTS.md

## Arquitectura de Agentes - Backend NestJS + Prisma

Este documento define los agentes del sistema, sus responsabilidades, límites y reglas de interacción siguiendo una arquitectura limpia y escalable.

---

## 📋 Tabla de Contenidos

1. [Visión General](#visión-general)
2. [Tipos de Agentes](#tipos-de-agentes)
3. [Matriz de Responsabilidades](#matriz-de-responsabilidades)
4. [Reglas de Interacción](#reglas-de-interacción)
5. [Flujos de Comunicación](#flujos-de-comunicación)

---

## Visión General

### Principios Arquitectónicos

El sistema está organizado en **capas concéntricas** inspiradas en Clean Architecture:

```
┌─────────────────────────────────────────┐
│     Infrastructure Layer (Agentes)      │
│  ┌───────────────────────────────────┐  │
│  │   Application Layer (Agentes)    │  │
│  │  ┌───────────────────────────┐   │  │
│  │  │  Domain Layer (Agentes)  │   │  │
│  │  │                           │   │  │
│  │  │   Business Logic Core    │   │  │
│  │  └───────────────────────────┘   │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

**Regla de Dependencia**: Las dependencias apuntan hacia adentro. El dominio no conoce infraestructura.

---

## Tipos de Agentes

### 1. 🎯 Domain Agents (Capa de Dominio)

#### 1.1 Entity Agent
**Responsabilidad**: Gestionar entidades de dominio y lógica de negocio pura.

**Límites**:
- ✅ Define modelos de dominio (sin anotaciones de ORM)
- ✅ Implementa validaciones de negocio
- ✅ Contiene lógica invariante del dominio
- ❌ NO accede a base de datos directamente
- ❌ NO conoce frameworks o librerías externas
- ❌ NO maneja HTTP requests/responses

**Ubicación**: `src/domain/entities/`

**Ejemplo**:
```typescript
// user.entity.ts
export class User {
  constructor(
    public readonly id: string,
    public email: Email, // Value Object
    public password: HashedPassword,
    public profile: UserProfile
  ) {}

  changeEmail(newEmail: Email): void {
    // Validación de negocio
    if (!newEmail.isValid()) {
      throw new InvalidEmailError();
    }
    this.email = newEmail;
  }
}
```

#### 1.2 Value Object Agent
**Responsabilidad**: Representar conceptos del dominio sin identidad.

**Límites**:
- ✅ Inmutables por diseño
- ✅ Auto-validables
- ✅ Encapsulan lógica de validación
- ❌ NO tienen identidad (no tienen ID)
- ❌ NO mutan estado

**Ubicación**: `src/domain/value-objects/`

**Ejemplo**:
```typescript
// email.vo.ts
export class Email {
  private constructor(private readonly value: string) {}

  static create(email: string): Result<Email> {
    if (!this.isValidFormat(email)) {
      return Result.fail('Invalid email format');
    }
    return Result.ok(new Email(email));
  }

  getValue(): string {
    return this.value;
  }
}
```

#### 1.3 Domain Service Agent
**Responsabilidad**: Lógica de negocio que no pertenece a una sola entidad.

**Límites**:
- ✅ Orquesta múltiples entidades
- ✅ Implementa reglas de negocio complejas
- ✅ Sin estado (stateless)
- ❌ NO accede a infraestructura
- ❌ NO depende de casos de uso

**Ubicación**: `src/domain/services/`

#### 1.4 Repository Interface Agent
**Responsabilidad**: Definir contratos de persistencia (puertos).

**Límites**:
- ✅ Define métodos de acceso a datos
- ✅ Trabaja con entidades de dominio
- ✅ Interfaces puras (sin implementación)
- ❌ NO implementa lógica de persistencia
- ❌ NO conoce Prisma u ORM específico

**Ubicación**: `src/domain/repositories/`

---

### 2. 🔧 Application Agents (Capa de Aplicación)

#### 2.1 Use Case Agent
**Responsabilidad**: Orquestar flujos de negocio específicos.

**Límites**:
- ✅ Implementa casos de uso de la aplicación
- ✅ Coordina entidades y servicios de dominio
- ✅ Maneja transacciones
- ✅ Aplica autorización de negocio
- ❌ NO contiene lógica de dominio
- ❌ NO maneja detalles HTTP
- ❌ NO conoce implementaciones de repositorios

**Ubicación**: `src/application/use-cases/`

**Ejemplo**:
```typescript
// create-user.use-case.ts
@Injectable()
export class CreateUserUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordHasher: IPasswordHasher,
    private readonly eventBus: IEventBus
  ) {}

  async execute(dto: CreateUserDto): Promise<Result<UserDto>> {
    // 1. Validar datos de entrada
    const emailOrError = Email.create(dto.email);
    if (emailOrError.isFailure) {
      return Result.fail(emailOrError.error);
    }

    // 2. Verificar unicidad
    const existingUser = await this.userRepository.findByEmail(emailOrError.value);
    if (existingUser) {
      return Result.fail('Email already registered');
    }

    // 3. Crear entidad
    const hashedPassword = await this.passwordHasher.hash(dto.password);
    const user = new User(uuid(), emailOrError.value, hashedPassword);

    // 4. Persistir
    await this.userRepository.save(user);

    // 5. Emitir evento de dominio
    await this.eventBus.publish(new UserCreatedEvent(user.id));

    return Result.ok(UserMapper.toDto(user));
  }
}
```

#### 2.2 DTO Agent
**Responsabilidad**: Transferir datos entre capas.

**Límites**:
- ✅ Objetos planos de transferencia
- ✅ Validaciones con class-validator
- ✅ Documentación con decoradores
- ❌ NO contienen lógica de negocio
- ❌ NO son entidades de dominio

**Ubicación**: `src/application/dtos/`

#### 2.3 Mapper Agent
**Responsabilidad**: Transformar entre entidades de dominio y DTOs/modelos de persistencia.

**Límites**:
- ✅ Transformaciones bidireccionales
- ✅ Manejo de tipos complejos
- ❌ NO contiene lógica de negocio
- ❌ NO accede a base de datos

**Ubicación**: `src/application/mappers/`

#### 2.4 Event Handler Agent
**Responsabilidad**: Reaccionar a eventos de dominio.

**Límites**:
- ✅ Ejecuta efectos secundarios
- ✅ Puede disparar otros casos de uso
- ✅ Debe ser idempotente
- ❌ NO modifica entidades directamente
- ❌ NO falla silenciosamente

**Ubicación**: `src/application/event-handlers/`

---

### 3. 🌐 Infrastructure Agents (Capa de Infraestructura)

#### 3.1 API Controller Agent
**Responsabilidad**: Exponer endpoints HTTP y manejar requests/responses.

**Límites**:
- ✅ Define rutas y métodos HTTP
- ✅ Valida entrada con DTOs
- ✅ Maneja autenticación/autorización HTTP
- ✅ Formatea respuestas
- ✅ Maneja códigos de estado HTTP
- ❌ NO contiene lógica de negocio
- ❌ NO accede directamente a repositorios
- ❌ NO implementa validaciones de dominio

**Ubicación**: `src/infrastructure/api/controllers/`

**Ejemplo**:
```typescript
// user.controller.ts
@Controller('users')
@ApiTags('Users')
export class UserController {
  constructor(
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly getUserUseCase: GetUserUseCase
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new user' })
  async create(@Body() dto: CreateUserDto): Promise<ApiResponse<UserDto>> {
    const result = await this.createUserUseCase.execute(dto);
    
    if (result.isFailure) {
      throw new BadRequestException(result.error);
    }

    return {
      success: true,
      data: result.value,
      message: 'User created successfully'
    };
  }
}
```

#### 3.2 Repository Implementation Agent
**Responsabilidad**: Implementar interfaces de repositorio usando Prisma.

**Límites**:
- ✅ Implementa interfaces del dominio
- ✅ Traduce entidades ↔ modelos Prisma
- ✅ Maneja queries y transacciones
- ✅ Implementa patrón Unit of Work
- ❌ NO expone detalles de Prisma al dominio
- ❌ NO contiene lógica de negocio
- ❌ NO maneja validaciones de dominio

**Ubicación**: `src/infrastructure/persistence/repositories/`

**Ejemplo**:
```typescript
// prisma-user.repository.ts
@Injectable()
export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<User | null> {
    const prismaUser = await this.prisma.user.findUnique({
      where: { id },
      include: { profile: true }
    });

    if (!prismaUser) return null;

    return UserMapper.toDomain(prismaUser);
  }

  async save(user: User): Promise<void> {
    const prismaData = UserMapper.toPrisma(user);
    
    await this.prisma.user.upsert({
      where: { id: user.id },
      create: prismaData,
      update: prismaData
    });
  }
}
```

#### 3.3 Database Migration Agent
**Responsabilidad**: Gestionar esquema de base de datos.

**Límites**:
- ✅ Define schema Prisma
- ✅ Crea migraciones versionadas
- ✅ Maneja rollbacks
- ❌ NO modifica datos directamente en producción
- ❌ NO crea migraciones manuales en prod

**Ubicación**: `prisma/migrations/`

#### 3.4 Authentication Agent
**Responsabilidad**: Manejar autenticación y tokens.

**Límites**:
- ✅ Genera y valida JWT
- ✅ Implementa estrategias de autenticación (Guards)
- ✅ Maneja refresh tokens
- ✅ Protege rutas
- ❌ NO implementa lógica de autorización de negocio
- ❌ NO accede directamente a repositorios de dominio

**Ubicación**: `src/infrastructure/auth/`

#### 3.5 Validation Agent
**Responsabilidad**: Validar datos de entrada a nivel de infraestructura.

**Límites**:
- ✅ Usa class-validator y class-transformer
- ✅ Valida DTOs en controllers
- ✅ Sanitiza entrada de usuario
- ❌ NO reemplaza validaciones de dominio
- ❌ NO contiene reglas de negocio

**Ubicación**: `src/infrastructure/validation/`

#### 3.6 Exception Filter Agent
**Responsabilidad**: Capturar y formatear errores globalmente.

**Límites**:
- ✅ Traduce excepciones de dominio a HTTP
- ✅ Oculta detalles internos
- ✅ Loguea errores
- ✅ Retorna respuestas consistentes
- ❌ NO modifica lógica de negocio
- ❌ NO silencia errores críticos

**Ubicación**: `src/infrastructure/filters/`

#### 3.7 Logging Agent
**Responsabilidad**: Registrar eventos y errores del sistema.

**Límites**:
- ✅ Implementa logging estructurado
- ✅ Diferentes niveles (debug, info, warn, error)
- ✅ Integración con servicios externos (Sentry, CloudWatch)
- ❌ NO loguea información sensible
- ❌ NO bloquea ejecución principal

**Ubicación**: `src/infrastructure/logging/`

#### 3.8 Configuration Agent
**Responsabilidad**: Gestionar configuración de la aplicación.

**Límites**:
- ✅ Carga variables de entorno
- ✅ Valida configuración al inicio
- ✅ Provee configuración tipada
- ❌ NO expone secretos en logs
- ❌ NO permite configuración en runtime sin validación

**Ubicación**: `src/infrastructure/config/`

---

### 4. 🔒 Security Agents (Transversales)

#### 4.1 Authorization Agent
**Responsabilidad**: Controlar acceso basado en roles y permisos.

**Límites**:
- ✅ Implementa RBAC/ABAC
- ✅ Verifica permisos antes de ejecutar use cases
- ✅ Protege recursos
- ❌ NO confunde con autenticación
- ❌ NO hardcodea permisos en controllers

**Ubicación**: `src/infrastructure/authorization/`

#### 4.2 Rate Limiting Agent
**Responsabilidad**: Prevenir abuso de API.

**Límites**:
- ✅ Limita requests por IP/usuario
- ✅ Configurable por endpoint
- ✅ Responde con 429 Too Many Requests
- ❌ NO bloquea tráfico legítimo
- ❌ NO aplica en ambiente de desarrollo

**Ubicación**: `src/infrastructure/security/rate-limit/`

#### 4.3 Input Sanitization Agent
**Responsabilidad**: Prevenir inyecciones y XSS.

**Límites**:
- ✅ Sanitiza entrada de usuario
- ✅ Valida tipos de datos
- ✅ Escapa caracteres especiales
- ❌ NO modifica lógica de validación de dominio
- ❌ NO confía en validación del cliente

**Ubicación**: `src/infrastructure/security/sanitization/`

---

## Matriz de Responsabilidades

| Agente | Validación Entrada | Lógica Negocio | Persistencia | HTTP | Seguridad |
|--------|-------------------|----------------|--------------|------|-----------|
| Entity | ❌ | ✅ | ❌ | ❌ | ❌ |
| Value Object | ✅ (propia) | ✅ | ❌ | ❌ | ❌ |
| Domain Service | ❌ | ✅ | ❌ | ❌ | ❌ |
| Use Case | ✅ (delegada) | ✅ (orquesta) | ✅ (usa repos) | ❌ | ✅ (autorización) |
| Controller | ✅ (DTOs) | ❌ | ❌ | ✅ | ✅ (autenticación) |
| Repository Impl | ❌ | ❌ | ✅ | ❌ | ❌ |
| Auth Agent | ❌ | ❌ | ❌ | ✅ | ✅ |
| Exception Filter | ❌ | ❌ | ❌ | ✅ | ✅ (no exponer) |

---

## Reglas de Interacción

### 1. Flujo de Dependencias

```
Controller → Use Case → Domain Service → Entity
     ↓           ↓              ↓
   DTO      Repository    Value Object
                Interface
                    ↑
              Repository
             Implementation
```

### 2. Reglas Estrictas

#### ✅ PERMITIDO:
- Domain → Domain (entidades usan value objects)
- Application → Domain (use cases usan entidades)
- Infrastructure → Application (controllers usan use cases)
- Infrastructure → Domain (repositories implementan interfaces)

#### ❌ PROHIBIDO:
- Domain → Application (entidades NO conocen use cases)
- Domain → Infrastructure (entidades NO conocen Prisma)
- Application → Infrastructure Details (use cases NO conocen HTTP)

### 3. Inversión de Dependencias

**Problema**: Use cases necesitan persistencia, pero no deben depender de Prisma.

**Solución**:
```typescript
// Domain layer (interface)
export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  save(user: User): Promise<void>;
}

// Application layer (use case)
@Injectable()
export class CreateUserUseCase {
  constructor(
    @Inject('IUserRepository')
    private readonly userRepository: IUserRepository
  ) {}
}

// Infrastructure layer (implementation)
@Injectable()
export class PrismaUserRepository implements IUserRepository {
  // Implementación con Prisma
}

// Module (DI binding)
@Module({
  providers: [
    {
      provide: 'IUserRepository',
      useClass: PrismaUserRepository
    }
  ]
})
```

### 4. Comunicación entre Agentes

#### Síncrona (Request-Response):
```
Client → Controller → Use Case → Repository → Database
                           ↓
                       Domain Service
                           ↓
                        Entity
```

#### Asíncrona (Event-Driven):
```
Use Case → Event Bus → Event Handler → Use Case
    ↓                                      ↓
Emit Event                            Side Effect
```

### 5. Manejo de Errores

**Propagación**:
```
Domain Error → Application Error → HTTP Exception
   (throw)         (Result<T>)        (catch)
```

**Ejemplo**:
```typescript
// Domain
class InvalidEmailError extends Error {}

// Application
const result = Result.fail(new InvalidEmailError());

// Infrastructure
if (result.isFailure) {
  throw new BadRequestException(result.error.message);
}
```

---

## Flujos de Comunicación

### Flujo 1: Crear Usuario

```
POST /users
    ↓
UserController.create()
    ↓
CreateUserUseCase.execute()
    ↓
├─→ Email.create() (Value Object)
├─→ UserRepository.findByEmail()
├─→ PasswordHasher.hash()
├─→ User (Entity creation)
├─→ UserRepository.save()
└─→ EventBus.publish(UserCreatedEvent)
    ↓
Return UserDto
```

### Flujo 2: Autenticación

```
POST /auth/login
    ↓
AuthController.login()
    ↓
LoginUseCase.execute()
    ↓
├─→ UserRepository.findByEmail()
├─→ PasswordHasher.compare()
├─→ JwtService.sign()
└─→ RefreshTokenRepository.save()
    ↓
Return { accessToken, refreshToken }
```

### Flujo 3: Consulta con Autorización

```
GET /users/:id
    ↓
AuthGuard (verify JWT)
    ↓
RolesGuard (check permissions)
    ↓
UserController.findOne()
    ↓
GetUserUseCase.execute()
    ↓
├─→ AuthorizationService.canAccess()
└─→ UserRepository.findById()
    ↓
Return UserDto
```

---

## Principios SOLID Aplicados

### Single Responsibility Principle (SRP)
- Cada agente tiene **una única razón para cambiar**
- Controllers solo manejan HTTP, Use Cases solo orquestan lógica

### Open/Closed Principle (OCP)
- Extensible mediante interfaces (IRepository, IEventBus)
- Cerrado a modificación (domain entities estables)

### Liskov Substitution Principle (LSP)
- Implementaciones de repositorios son intercambiables
- Mocks sustituyen implementaciones reales en tests

### Interface Segregation Principle (ISP)
- Interfaces específicas por necesidad (IUserRepository, IProductRepository)
- No interfaces monolíticas

### Dependency Inversion Principle (DIP)
- Use cases dependen de abstracciones (interfaces)
- Implementaciones se inyectan mediante DI de NestJS

---

## Checklist de Cumplimiento

Al implementar un nuevo feature, verificar:

- [ ] ¿Las entidades de dominio están libres de dependencias externas?
- [ ] ¿Los use cases dependen solo de interfaces?
- [ ] ¿Los controllers delegan toda lógica a use cases?
- [ ] ¿Los repositorios implementan interfaces del dominio?
- [ ] ¿Los errores se propagan correctamente entre capas?
- [ ] ¿Los DTOs están separados de las entidades de dominio?
- [ ] ¿Las validaciones de negocio están en el dominio?
- [ ] ¿Las validaciones de entrada están en DTOs?
- [ ] ¿Se aplica inversión de dependencias?
- [ ] ¿Los tests son independientes de la infraestructura?

---

## Diagrama de Arquitectura Completo

```
┌─────────────────────────────────────────────────────────────┐
│                     PRESENTATION LAYER                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │Controller│  │ Guards   │  │ Filters  │  │  Pipes   │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
└───────┼─────────────┼─────────────┼─────────────┼──────────┘
        │             │             │             │
┌───────┼─────────────┼─────────────┼─────────────┼──────────┐
│       ▼             ▼             ▼             ▼          │
│                   APPLICATION LAYER                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │Use Cases │  │   DTOs   │  │ Mappers  │  │ Events   │   │
│  └────┬─────┘  └──────────┘  └────┬─────┘  └────┬─────┘   │
└───────┼─────────────────────────────┼─────────────┼─────────┘
        │                             │             │
┌───────┼─────────────────────────────┼─────────────┼─────────┐
│       ▼                             ▼             ▼         │
│                      DOMAIN LAYER                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │Entities  │  │Value Obj │  │ Services │  │Interface │   │
│  └──────────┘  └──────────┘  └──────────┘  │Repository│   │
│                                             └────┬─────┘   │
└──────────────────────────────────────────────────┼─────────┘
                                                   │
┌──────────────────────────────────────────────────┼─────────┐
│                                                  ▼         │
│                  INFRASTRUCTURE LAYER                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │Prisma    │  │  Auth    │  │ Config   │  │ Logging  │   │
│  │Repos     │  │ Passport │  │ .env     │  │ Winston  │   │
│  └────┬─────┘  └──────────┘  └──────────┘  └──────────┘   │
└───────┼────────────────────────────────────────────────────┘
        │
        ▼
   ┌─────────┐
   │Database │
   │PostgreSQL│
   └─────────┘
```

---

## Conclusión

Esta arquitectura de agentes garantiza:
- ✅ **Mantenibilidad**: Cambios localizados en capas específicas
- ✅ **Testabilidad**: Cada agente testeable independientemente
- ✅ **Escalabilidad**: Fácil agregar nuevos features sin romper existentes
- ✅ **Seguridad**: Separación de concerns y validaciones en múltiples capas
- ✅ **Clean Code**: Responsabilidades claras y código autoexplicativo

**Recuerda**: La arquitectura es una guía, no una prisión. Adapta según necesidades, pero siempre respetando los principios fundamentales.
