import { NotificationPreference } from './notification-preference.model';

export const NOTIFICATION_PREFERENCE_REPOSITORY = 'NOTIFICATION_PREFERENCE_REPOSITORY';

export const NotificationPreferenceRepository = {
  provide: NOTIFICATION_PREFERENCE_REPOSITORY,
  useValue: NotificationPreference,
};
