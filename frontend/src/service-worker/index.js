/**
 * Service Worker Module
 * Central export point for all service worker setup
 *
 * Note: This is the source code organized for maintainability.
 * The actual service-worker.js file must remain in /public for proper scope.
 */

export { setupPushHandler, setupClickHandler, setupCloseHandler } from './handlers';
export { setupInstallHandler, setupActivateHandler } from './lifecycle';
