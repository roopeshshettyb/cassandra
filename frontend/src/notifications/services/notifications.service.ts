/**
 * Notifications Service
 * Handles browser notification permission and Service Worker registration
 */

export const NotificationsService = {
  /**
   * Initialize notifications: register Service Worker and request permission
   * Returns true if notifications are fully enabled, false otherwise
   */
  async initialize(): Promise<boolean> {
    // Check if notifications are supported
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      return false;
    }

    try {
      // Register Service Worker from root
      await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/',
      });

      // Request notification permission
      if (Notification.permission === 'granted') {
        return true;
      }

      if (Notification.permission !== 'denied') {
        const result = await Notification.requestPermission();
        return result === 'granted';
      }

      return false;
    } catch (error) {
      console.error('Failed to initialize notifications:', error);
      return false;
    }
  },
};
