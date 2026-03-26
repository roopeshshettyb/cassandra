/**
 * Notification-related TypeScript interfaces
 */

export interface NotificationItem {
  id: number;
  title: string;
  message: string;
  read: boolean;
  link?: string;
  toneUrl?: string;
  hotelId?: number;
  createdAt: string;
}

export interface UseNotificationsOptions {
  token?: string;
  enabled?: boolean;
  hotelId?: number;
}
