# Phase 9: Admin Calendar and Operational Management Architecture

## Overview

Phase 9 implements the administrative calendar query engine and workstation operational management features for the Sayra Reservation Engine. It provides site-aware, timezone-accurate, and role-guarded APIs for gaming center managers, supervisors, and staff to monitor reservations, view station availability, schedule station maintenance windows, and manage operational resources.

---

## 1. Architectural Components

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Express Router (`/api/v1/gamingCenters/:gamingCenterId/admin/calendar` &       │
│                `/api/v1/gamingCenters/:gamingCenterId/stations/:id/maintenance`)│
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Middleware Guard Layer (`authMiddleware`, `tenantGuard`, `requireRole`)         │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │
                                         ▼
┌────────────────────────────────────────┴────────────────────────────────────────┐
│ Module Layer                                                                    │
│ ┌─────────────────────────────────────┐ ┌─────────────────────────────────────┐ │
│ │ Calendar Module                     │ │ Station Module Extension            │ │
│ │ (`calendar.station.ts`)             │ │ (`station.station.ts`)              │ │
│ │ - Site timezone boundary conversion │ │ - Active reservation conflict check │ │
│ │ - Local & UTC timestamp formatting │ │ - Audit logging integration         │ │
│ └─────────────────────────────────────┘ └─────────────────────────────────────┘ │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Repository & Persistence Layer (`PrismaClient` + PostgreSQL)                     │
│ - Overlapping interval queries `[startTime < rangeEnd AND endTime > rangeStart]`│
│ - Site settings resolution (`Settings.timeZone`)                                │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Admin Calendar Engine (`sayra/src/modules/calendar/`)

### 2.1 Route Endpoints & RBAC Authorization
- `GET /api/v1/gamingCenters/:gamingCenterId/admin/calendar`
- `GET /api/v1/gamingCenters/:gamingCenterId/calendar`
- **Authorized Roles**: `MANAGER`, `SUPERVISOR`, `STAFF`
- **Guards**: `authMiddleware`, `tenantGuard` (strictly enforces `gamingCenterId` match).

### 2.2 Timezone & Date Boundary Semantics
- **Site Timezone Resolution**: Queries `Settings.timeZone` for the gaming center (defaults to `'UTC'`, or configured value e.g., `'Asia/Tehran'`).
- **Date Boundary Conversion**:
  - Accepts plain date strings (`YYYY-MM-DD`) or full ISO 8601 strings.
  - Plain date parameters convert to site-local start-of-day (`00:00:00`) and end-of-day (`23:59:59.999`) prior to UTC conversion using `fromZonedTime`.
  - Date range is bounded and validated to prevent unbounded DB queries (maximum 31 days per query).
- **Interval Overlap Querying**:
  - Identifies all reservations where `startTime < rangeEndUtc AND endTime > rangeStartUtc`.
  - Identifies station maintenance windows where `startTime < rangeEndUtc AND (endTime IS NULL OR endTime > rangeStartUtc)`.
- **Response Format**:
  - Provides ISO UTC timestamps (`startTimeUtc`, `endTimeUtc`) alongside site-local zoned ISO strings (`startTimeLocal`, `endTimeLocal`) to prevent timezone ambiguity in consumer frontends.

### 2.3 Query Filters & Pagination
- Filters: `dateFrom` (required), `dateTo` (required), `status` (single or array of `ReservationStatus`), `stationId` (CUID), `staffId` (CUID), `customerAccountId` (CUID).
- Pagination: Standard `page` and `pageSize` (max 500) parameters for reservation result sets.

---

## 3. Workstation Maintenance Operations (`sayra/src/modules/station/`)

### 3.1 Route Endpoints & RBAC Authorization
- `GET /api/v1/gamingCenters/:gamingCenterId/stations/:stationId/maintenance`
  - **Authorized Roles**: `MANAGER`, `SUPERVISOR`, `STAFF`
- `POST /api/v1/gamingCenters/:gamingCenterId/stations/:stationId/maintenance`
  - **Authorized Roles**: `MANAGER`, `SUPERVISOR`
- `DELETE /api/v1/gamingCenters/:gamingCenterId/stations/:stationId/maintenance/:maintenanceId`
  - **Authorized Roles**: `MANAGER`, `SUPERVISOR`

### 3.2 Active Reservation Conflict Validation
When a request to schedule a station maintenance window is received:
1. The engine checks that the station exists and belongs to the specified `gamingCenterId`.
2. The engine executes `findOverlappingReservationsForMaintenance` to check for active reservations (`CONFIRMED`, `IN_PROGRESS`, or active `PENDING`) that overlap the maintenance window.
3. If active reservations exist during the requested maintenance period, the request is rejected with **HTTP 409 Conflict**:
   ```json
   {
     "success": false,
     "error": {
       "message": "Cannot schedule maintenance: active reservation(s) exist during the requested period.",
       "statusCode": 409,
       "code": "MAINTENANCE_CONFLICT_WITH_RESERVATION",
       "details": {
         "conflictingReservations": [ ... ]
       }
     }
   }
   ```
4. Existing reservations are preserved without silent modifications or cancellations.

### 3.3 Audit Event Recording
All creation and deletion operations on station maintenance records generate immutable `AuditLog` entries:
- Action: `STATION_MAINTENANCE_CREATE` or `STATION_MAINTENANCE_DELETE`
- Entity: `GameStation`
- Entity ID: `stationId`

---

## 4. API Response Shapes

### 4.1 Admin Calendar Endpoint (`GET /api/v1/gamingCenters/:id/admin/calendar`)
```json
{
  "success": true,
  "data": {
    "site": {
      "id": "clx0000000000000000000000",
      "name": "GameNet Alpha",
      "slug": "gamenet-alpha",
      "timeZone": "Asia/Tehran"
    },
    "range": {
      "dateFrom": "2026-12-01",
      "dateTo": "2026-12-05",
      "rangeStartUtc": "2026-11-30T20:30:00.000Z",
      "rangeEndUtc": "2026-12-05T20:29:59.999Z",
      "rangeStartLocal": "2026-12-01T00:00:00.000+03:30",
      "rangeEndLocal": "2026-12-05T23:59:59.999+03:30"
    },
    "workstations": [
      {
        "id": "station-1",
        "name": "PC-01",
        "stationType": "PC",
        "isVip": true,
        "hourlyPrice": 120,
        "isActive": true
      }
    ],
    "maintenances": [
      {
        "id": "maint-1",
        "stationId": "station-1",
        "stationName": "PC-01",
        "stationType": "PC",
        "reason": "GPU Upgrade",
        "cost": 200,
        "startTimeUtc": "2026-12-02T08:00:00.000Z",
        "endTimeUtc": "2026-12-02T12:00:00.000Z",
        "startTimeLocal": "2026-12-02T11:30:00.000+03:30",
        "endTimeLocal": "2026-12-02T15:30:00.000+03:30",
        "createdAt": "2026-11-30T10:00:00.000Z"
      }
    ],
    "reservations": {
      "data": [
        {
          "id": "res-1",
          "gamingCenterId": "clx0000000000000000000000",
          "stationId": "station-1",
          "stationName": "PC-01",
          "stationType": "PC",
          "isVipStation": true,
          "customerAccountId": "cust-1",
          "customerName": "Ali Reza",
          "customerPhone": "+989123456789",
          "staffId": "staff-1",
          "staffName": "Staff One",
          "status": "CONFIRMED",
          "paymentState": "PAID",
          "totalHours": 2,
          "totalPrice": 240,
          "discountAmount": 0,
          "groupBookingId": null,
          "startTimeUtc": "2026-12-01T10:00:00.000Z",
          "endTimeUtc": "2026-12-01T12:00:00.000Z",
          "startTimeLocal": "2026-12-01T13:30:00.000+03:30",
          "endTimeLocal": "2026-12-01T15:30:00.000+03:30",
          "note": null,
          "createdAt": "2026-11-30T10:00:00.000Z"
        }
      ],
      "meta": {
        "page": 1,
        "pageSize": 100,
        "totalItems": 1,
        "totalPages": 1
      }
    }
  }
}
```
