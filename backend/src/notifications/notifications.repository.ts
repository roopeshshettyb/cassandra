import { Notification } from './notifications.model';

export const NOTIFICATIONS_REPOSITORY = 'NOTIFICATIONS_REPOSITORY';

export const NotificationsRepository = {
  provide: NOTIFICATIONS_REPOSITORY,
  useValue: Notification,
};

