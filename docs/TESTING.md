# Testing Architecture Design

## Overview
This document outlines the testing infrastructure for the Playenest project. The goal is to provide a scalable, fast, and maintainable testing foundation that supports unit, integration, API, and E2E testing.

## Testing Stack
- **Test Runner:** Jest
- **TypeScript Support:** ts-jest
- **API Testing:** Supertest
- **Mocking:** jest-mock-extended (for Prisma and complex objects), native Jest mocks
- **CI/CD:** GitHub Actions

## Directory Structure
```text
/tests
  /unit          # Pure business logic tests (Services, Utils, Validators)
  /integration   # Tests for components interacting with database/external services
  /api           # HTTP/REST API tests using Supertest
  /e2e           # End-to-end user flow tests
  /fixtures      # Static data used in tests
  /factories     # Dynamic mock data generators
  /mocks         # Global mocks (e.g., Prisma, Redis)
  /helpers       # Test-specific helper functions
  /utils         # Test utilities
```

## Mocking Strategy
- **Database:** Prisma is mocked globally in unit tests using `jest-mock-extended`.
- **External Services:** Services like SMS providers, Sentry, and Redis are mocked in `tests/setup.ts` or within specific test files.
- **Hashing:** For performance, computationally expensive libraries like `argon2` should be mocked or configured with low work factors in tests.

## Test Database Strategy
- **Unit Tests:** Always use mocks. No database connection required.
- **Integration/API Tests:** Use a dedicated PostgreSQL test database. Migrations should run before the test suite, and each test should run in a transaction or clean up after itself.

## Environment Setup
1. Install dependencies: `npm install`
2. Run tests: `npm test`
3. Run with coverage: `npm run test:cov`
4. Use `.env.test` for test-specific environment variables.
