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

export interface RequestOptions {
  endpoint: string;
  method?: string;
  data?: any;
  token?: string;
  headers?: any;
  setLoading?: (loading: boolean) => void;
  setData?: (data: any) => void;
  defaultData?: any;
  throw?: boolean;
  alertSuccess?: (message: string) => void;
  alertError?: (message: string) => void;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data: T;
}
