import { authHandlers } from './handlers/auth';
import { publicHandlers } from './handlers/public';
import { gamingCenterHandlers } from './handlers/gamingCenters';
import { reservationHandlers } from './handlers/reservations';
import { analyticsHandlers, cmsHandlers, commissionHandlers } from './handlers/analytics';
import { ticketHandlers } from './handlers/tickets';

export const handlers = [
  ...authHandlers,
  ...publicHandlers,
  ...gamingCenterHandlers,
  ...reservationHandlers,
  ...analyticsHandlers,
  ...cmsHandlers,
  ...commissionHandlers,
  ...ticketHandlers,
];
