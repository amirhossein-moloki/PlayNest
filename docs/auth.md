# Authentication, OTP, Sessions

This document describes authentication based strictly on the current implementation.

## Overview (Persian)

سیستم ورود ما برای دو گروه مختلف طراحی شده: **کارمندان سالن (Users)** و **مشتریان (Customers)**.

### ۱. ورود کارمندان سالن
کارمندان برای ورود به پنل خودشان به سه چیز نیاز دارند: شماره تلفن، رمز عبور، و شناسه سالن (GamingCenter ID). سیستم چک می‌کند که آیا رمز عبور با شماره تلفن این شخص در همان سالن مطابقت دارد یا نه.

### ۲. ورود مشتریان
مشتریان برای ورود فقط به شماره تلفن نیاز دارند. سیستم چک می‌کند که آیا مشتری با این شماره تلفن قبلاً ثبت‌نام کرده است یا نه. اگر اولین بار باشد، سیستم به صورت خودکار یک حساب کاربری برای او ایجاد می‌کند.

---

## Auth Concepts

### Actors

Sessions are polymorphic via `SessionActorType`:

- `USER` — staff members (from `User` model)
- `CUSTOMER` — end customers (from `CustomerAccount` model)

### Tokens

- **Access tokens** are JWTs created with `JWT_ACCESS_SECRET`.
- **Refresh tokens** are random 32-byte hex strings; only their **SHA-256 hash** is stored in `Session.tokenHash`.

### Session Storage

A `Session` row is created at login time:

- `actorType` + `actorId` identify the subject.
- `tokenHash` stores the hashed refresh token.
- `expiresAt` is set to 7 days from creation in `AuthService.createAndSaveSession`.

## Login Flows

### User login with password

1. POST `/auth/login` with `actorType=USER`, `phone`, `password`, and `gamingCenterId`.
2. Server verifies password hash (`argon2.verify`).
3. A `Session` is created and the client receives:
   - `accessToken` (JWT)
   - `refreshToken` (raw token, not stored in DB)

### User login with OTP

1. **Request OTP**: POST `/auth/user/otp/request` with `phone`.
   - Creates a `PhoneOtp` with `purpose=LOGIN`, `expiresAt` (2 minutes), `codeHash` (argon2 hash), and sends SMS.
2. **Verify OTP**: POST `/auth/user/otp/verify` with `phone` + `code`.
   - If valid, sets `consumedAt` and returns a list of gamingCenters tied to that phone.
3. **Complete login**: POST `/auth/user/login/otp` with `phone` + `gamingCenterId`.
   - Requires a `PhoneOtp` that was consumed in the last 5 minutes.
   - Creates a `Session` and returns tokens.

### Customer login

- POST `/auth/login` with `actorType=CUSTOMER` and `phone`.
- If no `CustomerAccount` exists, it is created.
- A `Session` is created and tokens are returned.

## Refresh Flow

- POST `/auth/refresh` with `refreshToken`.
- Server hashes the refresh token and finds the matching `Session`.
- If valid and not revoked/expired, a new access token is issued.

## Logout

- POST `/auth/logout` revokes the current session via `Session.revokedAt`.

## Authorization & Tenant Isolation

- `authMiddleware` verifies the JWT and loads the actor (`User` or `CustomerAccount`).
- `tenantGuard` enforces that the actor’s `gamingCenterId` matches the `:gamingCenterId` path parameter on tenant routes.
- `requireRole` restricts operations to specific `UserRole` values for staff endpoints.

## OTP & Security Details

- OTP length: 6 digits
- OTP expiration: 2 minutes
- OTP post-verification login window: 5 minutes
- OTP is stored hashed in `PhoneOtp.codeHash`
- OTP attempts are tracked in `PhoneOtp.attempts` but **not incremented** by current code.

## Known Gaps / TODO

- `SMSIR_OTP_TEMPLATE_ID` is required by `AuthService`, but it is not declared in `src/config/env.ts`.
- OTP attempt counts are not incremented in code.

## Source of Truth

- `src/modules/auth/auth.routes.ts`
- `src/modules/auth/auth.controller.ts`
- `src/modules/auth/auth.service.ts`
- `src/modules/auth/auth.validators.ts`
- `src/modules/auth/auth.tokens.ts`
- `src/common/middleware/auth.ts`
- `src/common/middleware/tenantGuard.ts`
- `src/config/env.ts`
- `prisma/schema.prisma`
