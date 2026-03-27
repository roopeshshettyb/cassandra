import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import request from '../../helper/api';
import { NotificationItem, UseNotificationsOptions, RequestOptions, ApiResponse } from '../types';
import { getNotificationTone, createAudioFromBlob } from '../../utils/notificationToneCache';

const typedRequest = request as (options: RequestOptions) => Promise<ApiResponse | null>;

/**
 * Single source of truth for all notifications state.
 * Manages:
 * - Real-time notifications via Socket.IO
 * - Backend API sync (fetch, mark read)
 * - Dynamic unread count calculation
 * - Browser notifications with Service Worker fallback
 */
export const useNotifications = (options: UseNotificationsOptions = {}) => {
  const { token, enabled = true, hotelId } = options;
  const socketRef = useRef<Socket | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Derived state - always accurate
  const unreadCount = notifications.filter((n) => !n.read).length;

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const response = await typedRequest({
        endpoint: '/notifications/list',
        method: 'GET',
        defaultData: [],
      });
      const data = response; // Backend returns the array directly
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
   * Convert tone name to actual URL
   */
  const getToneUrl = useCallback((toneName?: string): string | null => {
    if (!toneName || toneName === 'none') return null;

    // Map built-in tone names to file paths
    const toneMap: Record<string, string> = {
      gentle_chime: '/assets/tones/gentle_chime.mp3',
      alert_sound: '/assets/tones/alert_sound.mp3',
    };

    // If it's a built-in tone name, return the path
    if (toneMap[toneName]) {
      return toneMap[toneName];
    }

    // If it's already a URL (custom tone from S3), return as-is
    if (toneName.startsWith('http://') || toneName.startsWith('https://')) {
      return toneName;
    }

    return null;
  }, []);

  /**
   * Play notification tone (plays once per notification)
   * - Built-in tones: played directly from /assets/tones/
   * - Custom S3 tones: fetched via signed URL and cached in IndexedDB, then played from blob
   */
  const playNotificationTone = useCallback(
    async (toneName?: string, toneHotelId?: number) => {
      // Custom tone: use cache utility (download once, serve from blob)
      const isCustomS3 = toneName && (toneName.startsWith('https://') || toneName.startsWith('http://'));
      if (isCustomS3 && (toneHotelId || hotelId)) {
        try {
          const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
          const blob = await getNotificationTone(
            toneHotelId || hotelId,
            toneName,
            backendUrl,
            token || localStorage.getItem('token') || ''
          );
          if (blob) {
            const audio = createAudioFromBlob(blob);
            audio.volume = 1.0;

            const cleanup = () => {
              URL.revokeObjectURL(audio.src);
              audio.removeEventListener('ended', cleanup);
            };
            audio.addEventListener('ended', cleanup);

            audio.play().catch((err) => {
              cleanup();
              console.warn('⚠️ Failed to play cached tone:', err.name, err.message);
            });
            return;
          }
        } catch (error) {
          console.warn('⚠️ Cache lookup failed, falling back to direct URL:', error);
          // Fall through to direct URL playback below
        }
      }

      // Built-in tone (or cache miss fallback): play directly
      const toneUrl = getToneUrl(toneName);
      if (!toneUrl) return;

      try {
        const audio = new Audio();
        audio.crossOrigin = 'anonymous';
        audio.volume = 1.0;
        audio.src = toneUrl;

        const timeoutId = setTimeout(() => { audio.pause(); }, 10000);

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log('✅ Notification tone playing:', toneName);
              clearTimeout(timeoutId);
            })
            .catch((err) => {
              console.warn('⚠️ Failed to play tone:', err.name, err.message);
              clearTimeout(timeoutId);
            });
        }
      } catch (error) {
        console.error('Error creating audio element:', error);
      }
    },
    [getToneUrl, hotelId, token]
  );

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

    const socketUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:7678';
    const socket = io(`${socketUrl}/notifications`, {
      query: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    socket.on('notification', (data: any) => {
      console.log('[Notifications] Received notification:', data.title);

      // Play tone (non-blocking, handles autoplay restrictions gracefully)
      playNotificationTone(data.toneUrl, data.hotelId);

      // Show browser notification
      showBrowserNotification(data);

      // Refresh notifications list
      fetchNotifications();
    });

    socket.on('error', (error: any) => {
      console.error('[Notifications] Socket error:', error);
    });

    socket.on('disconnect', (reason: string) => {
      console.warn('[Notifications] Disconnected:', reason);
      if (reason === 'io server disconnect') {
        // Server disconnected, try to reconnect
        setTimeout(() => {
          console.log('[Notifications] Attempting to reconnect...');
          socket.connect();
        }, 1000);
      }
    });

    socket.on('connect', () => {
      console.log('[Notifications] Connected');
    });

    socket.on('connect_error', (error: any) => {
      console.warn('[Notifications] Connection error:', error.message);
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
      await typedRequest({
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
