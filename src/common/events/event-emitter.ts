import { EventEmitter } from 'events';

export const eventEmitter = new EventEmitter();

export enum AppEvents {
  RESERVATION_CREATED = 'reservation.created',
  RESERVATION_UPDATED = 'reservation.updated',
  RESERVATION_CONFIRMED = 'reservation.confirmed',
  RESERVATION_CANCELED = 'reservation.canceled',
  RESERVATION_COMPLETED = 'reservation.completed',
  RESERVATION_NOSHOW = 'reservation.noshow',
  PAYMENT_SUCCESS = 'payment.success',
  REVIEW_CREATED = 'rating.created',

  // CMS & Reaction Events
  CMS_POST_CREATED = 'cms.post.created',
  CMS_POST_UPDATED = 'cms.post.updated',
  CMS_POST_PUBLISHED = 'cms.post.published',
  CMS_PAGE_CREATED = 'cms.page.created',
  CMS_PAGE_UPDATED = 'cms.page.updated',
  CMS_PAGE_PUBLISHED = 'cms.page.published',
  CMS_PAGE_DELETED = 'cms.page.deleted',
  REACTION_CREATED = 'reaction.created',
  REACTION_UPDATED = 'reaction.updated',
  REACTION_REMOVED = 'reaction.removed',
  COMMENT_CREATED = 'comment.created',
  COMMENT_UPDATED = 'comment.updated',
  COMMENT_DELETED = 'comment.deleted',
  COMMENT_APPROVED = 'comment.approved',
}
