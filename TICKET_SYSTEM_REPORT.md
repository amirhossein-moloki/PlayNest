# Ticket Support System - Documentation

## 1. Architecture Summary
The Ticket Support System is implemented as a new module in `src/modules/tickets`. It follows the standard layered architecture of the project:
- **Routes:** Defines endpoints for User, Support, and Admin APIs.
- **Controller:** Handles request/response and pagination logic.
- **Station (Service):** Core business logic including status transitions and authorization checks.
- **Repository:** Direct database interactions via Prisma.
- **Validators:** Zod schemas for request validation.

## 2. Database Schema Summary
The following additions were made to `prisma/schema.prisma`:

### Enums
- `TicketStatus`: `OPEN`, `PENDING`, `ANSWERED`, `CLOSED`
- `TicketPriority`: `LOW`, `MEDIUM`, `HIGH`
- `TicketCategory`: `TECHNICAL`, `FINANCIAL`, `SALES`, `ACCOUNT`
- `TicketSenderType`: `USER`, `SUPPORT`
- `UserRole`: Added `SUPPORT` and `ADMIN`.
- `MediaType`: Added `DOCUMENT`.

### Models
- **Ticket**:
    - `id`, `customerAccountId` (userId), `assignedToUserId` (nullable), `subject`, `status`, `priority`, `category`, `createdAt`, `updatedAt`, `closedAt` (nullable).
- **TicketMessage**:
    - `id`, `ticketId`, `senderType`, `senderId`, `text`, `attachment` (nullable), `createdAt`.

## 3. Endpoint Documentation

### User APIs
- `GET /api/v1/tickets`: List own tickets.
- `GET /api/v1/tickets/:ticketId`: Get ticket details and messages.
- `POST /api/v1/tickets`: Create a new ticket.
- `POST /api/v1/tickets/:ticketId/messages`: Reply to a ticket.
- `POST /api/v1/tickets/:ticketId/attachments`: Upload an attachment.

### Support APIs
- `GET /api/v1/support/tickets`: List assigned tickets and OPEN tickets.
- `GET /api/v1/support/tickets/:ticketId`: Get ticket details.
- `PATCH /api/v1/support/tickets/:ticketId/assign`: Assign ticket to a support agent.
- `PATCH /api/v1/support/tickets/:ticketId/status`: Update ticket status.
- `POST /api/v1/support/tickets/:ticketId/messages`: Reply to a ticket.
- `POST /api/v1/support/tickets/:ticketId/attachments`: Upload an attachment.

### Admin APIs
- `GET /api/v1/admin/tickets`: List all tickets.
- `GET /api/v1/admin/tickets/statistics`: Get ticket counts (total, open, closed).
- `PATCH /api/v1/admin/tickets/:ticketId/assign`: Assign/reassign ticket.
- `PATCH /api/v1/admin/tickets/:ticketId/status`: Force status change.

## 4. Authorization Matrix
| Action | USER (Customer) | SUPPORT | ADMIN |
|---|---|---|---|
| Create Ticket | Yes (Own) | No | No |
| View Ticket | Yes (Own) | Yes (Assigned) | Yes (All) |
| Reply | Yes (Own) | Yes (Assigned) | Yes (All) |
| Assign | No | Yes (Self/Other) | Yes (All) |
| Close Ticket | No | Yes | Yes |

## 5. Status Workflow
1. **OPEN**: Initial state when created by a user.
2. **ANSWERED**: Set automatically when support replies.
3. **PENDING**: Set automatically when a user replies to an `ANSWERED` ticket.
4. **CLOSED**: Can be set by support or admin. No further replies allowed.

## 6. Migration Summary
- Schema changes applied and Prisma client regenerated.
- `UserRole` expanded to support internal support teams.

## 7. Files Created
- `src/modules/tickets/tickets.repo.ts`
- `src/modules/tickets/tickets.station.ts`
- `src/modules/tickets/tickets.controller.ts`
- `src/modules/tickets/tickets.validators.ts`
- `src/modules/tickets/tickets.routes.ts`
- `tests/integration/modules/tickets/tickets.test.ts`

## 8. Files Modified
- `prisma/schema.prisma`
- `src/routes/index.ts`
- `src/modules/media/media-upload.station.ts`
- `src/docs/openapi.yaml`

## 9. Potential Future Improvements
- Email/SMS notifications for ticket updates.
- Auto-assignment based on category or workload.
- Attachment size and type enforcement at the API level (Multer integration).
- Search tickets by content (Full-text search).
