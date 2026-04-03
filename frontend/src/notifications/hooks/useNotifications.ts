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
    const response = await typedRequest({
      endpoint: '/notifications/list',
      method: 'GET',
      setLoading,
      defaultData: [],
    });
    if (Array.isArray(response)) {
      setNotifications(response);
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
              // Delay revoking to prevent ERR_FILE_NOT_FOUND if the asynchronous media pipeline is still trying to access it
              setTimeout(() => {
                URL.revokeObjectURL(audio.src);
              }, 2000);
              audio.removeEventListener('ended', cleanup);
            };
            audio.addEventListener('ended', cleanup);

            audio.play().catch((err) => {
              cleanup();
              console.warn('⚠️ Failed to play cached tone:', err.message || err.name);
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

      const audio = new Audio();
      audio.crossOrigin = 'anonymous';
      audio.volume = 1.0;
      audio.src = toneUrl;

      const timeoutId = setTimeout(() => {
        audio.pause();
      }, 10000);

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            clearTimeout(timeoutId);
          })
          .catch((err) => {
            clearTimeout(timeoutId);
          });
      }
    },
    [getToneUrl, hotelId, token]
  );

  /**
   * Display browser notification (Desktop only)
   */
  const showBrowserNotification = useCallback((data: NotificationItem) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    try {
      const notif = new Notification(data.title, {
        body: data.message,
        icon: 'https://flashpact-public-bucket.s3.ap-south-1.amazonaws.com/samantha_logo.jpg',
      });

      notif.onclick = () => {
        window.focus();
        if (data.link) {
          window.location.href = data.link;
        }
      };
    } catch (error) {
      console.warn('Browser notification failed:', error);
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
      reconnectionAttempts: Infinity,
    });

    socket.on('notification', (data: any) => {
      console.log('[NOTIFICATIONS] Received real-time notification:', data);

      // Play tone
      playNotificationTone(data.toneUrl, data.hotelId);

      // Show browser notification
      showBrowserNotification(data);

      // Optimistic update
      setNotifications((prev) => [data, ...prev]);

      // Tell other pages (ManageRequests, BookingDetails) to refresh
      window.dispatchEvent(new CustomEvent('app:new_request', { detail: data }));
    });

    socket.on('connect', () => {
      console.log('[NOTIFICATIONS] WebSocket connected');
    });

    socket.on('disconnect', (reason: string) => {
      console.log('[NOTIFICATIONS] WebSocket disconnected:', reason);
      if (reason === 'io server disconnect') {
        socket.connect();
      }
    });

    socket.on('connect_error', (err) => {
      console.error('[NOTIFICATIONS] WebSocket connect error:', err.message);
    });





    socketRef.current = socket;

    // Initial fetch
    fetchNotifications();

    // Unlock Mobile Audio Context (iOS/Android) on first user interaction.
    // By playing a silent clip on a physical tap, the browser whitelists this tab for background audio.
    const unlockAudioContext = () => {
      try {
        const unlockAudio = new Audio('/assets/tones/gentle_chime.mp3');
        unlockAudio.volume = 0.01;
        const playPromise = unlockAudio.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            unlockAudio.pause();
            unlockAudio.currentTime = 0;
          }).catch(() => {});
        }
      } catch (e) {}
    };
    document.addEventListener('click', unlockAudioContext, { once: true });

    return () => {
      document.removeEventListener('click', unlockAudioContext);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [enabled, token]);

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
