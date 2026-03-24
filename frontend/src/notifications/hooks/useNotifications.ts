import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import request from '../../helper/api';
import { NotificationItem, UseNotificationsOptions } from '../types';

/**
 * Single source of truth for all notifications state.
 * Manages:
 * - Real-time notifications via Socket.IO
 * - Backend API sync (fetch, mark read)
 * - Dynamic unread count calculation
 * - Browser notifications with Service Worker fallback
 */
export const useNotifications = (options: UseNotificationsOptions = {}) => {
  const { token, enabled = true } = options;
  const socketRef = useRef<Socket | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Derived state - always accurate
  const unreadCount = notifications.filter((n) => !n.read).length;

  /**
   * Fetch notifications from backend
   */
  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const data = await (request as any)({
        endpoint: '/notifications/list',
        method: 'GET',
        defaultData: [],
      });
      if (Array.isArray(data)) {
        setNotifications(data);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Play notification tone (loops until dismissed)
   * Handles 'none', custom URLs, or built-in tones
   */
  const playNotificationTone = useCallback(async (toneUrl?: string) => {
    if (!toneUrl || toneUrl === 'none') return;

    try {
      const audio = new Audio();
      audio.crossOrigin = 'anonymous';
      audio.volume = 0.9; // Louder for notifications
      audio.src = toneUrl;
      audio.loop = true; // Loop continuously

      // Set max timeout (5 minutes) to prevent infinite playback
      const timeoutId = setTimeout(() => {
        audio.pause();
        audio.src = '';
      }, 300000); // 5 minutes max

      await audio.play();
      // Store timeout for potential cleanup
      (window as any).notificationAudioTimeout = timeoutId;
    } catch (error) {
      // Silently fail - could be browser autoplay policy or muted site
      // This is expected and not an error to log
    }
  }, []);

  /**
   * Display browser notification with Service Worker fallback
   */
  const showBrowserNotification = useCallback(async (data: NotificationItem) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(data.title, {
          body: data.message,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: `notification-${data.id}`,
          requireInteraction: false,
          data: { link: data.link, toneUrl: data.toneUrl },
        });
      } else {
        new Notification(data.title, {
          body: data.message,
          icon: '/favicon.ico',
        });
      }
    } catch (error) {
      console.warn('Notification display failed', error);
    }
  }, []);

  /**
   * Initialize Socket.IO connection for real-time notifications
   */
  useEffect(() => {
    if (!enabled || !token) return;

    const apiUrl = process.env.REACT_APP_BACKEND_URL || window.location.origin;
    const socket = io(`${apiUrl}/notifications`, {
      query: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    socket.on('notification', (data: any) => {
      // Play tone (non-blocking, handles autoplay restrictions gracefully)
      playNotificationTone(data.toneUrl);

      // Show browser notification
      showBrowserNotification(data);

      // Refresh notifications list
      fetchNotifications();
    });

    socket.on('error', (error: any) => {
      console.error('Notification socket error:', error);
    });

    socketRef.current = socket;

    // Initial fetch
    fetchNotifications();

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [enabled, token, fetchNotifications, showBrowserNotification, playNotificationTone]);

  /**
   * Mark single notification as read
   */
  const markAsRead = useCallback(async (notificationId: number) => {
    try {
      await (request as any)({
        endpoint: `/notifications/${notificationId}/read`,
        method: 'PATCH',
      });
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }, []);

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
  };
};
