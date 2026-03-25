import { Sequelize } from 'sequelize';
import { Notification } from '../notifications/notifications.model';

/**
 * Script to clear all notifications from the database
 * Run this before testing new notification links
 */
export async function clearNotifications(sequelize: Sequelize) {
  try {
    const deletedCount = await Notification.destroy({
      where: {},
      truncate: true,
    });
    console.log(`✅ Cleared ${deletedCount} notifications from database`);
  } catch (error) {
    console.error('❌ Failed to clear notifications:', error.message);
  }
}
