import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { UserProfile } from '../types';

export const notificationService = {
  async init() {
    if (!Capacitor.isNativePlatform()) {
      console.log('[NotificationService] Not on native mobile, skipping local notifications init.');
      return false;
    }

    try {
      const perm = await LocalNotifications.checkPermissions();
      console.log('[NotificationService] Permission status:', perm.display);
      
      if (perm.display !== 'granted') {
        const req = await LocalNotifications.requestPermissions();
        console.log('[NotificationService] Requested permissions, status:', req.display);
        return req.display === 'granted';
      }
      return true;
    } catch (e) {
      console.error('[NotificationService] Failed to initialize permissions:', e);
      return false;
    }
  },

  async cancelAll() {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel({
          notifications: pending.notifications.map(n => ({ id: n.id }))
        });
        console.log(`[NotificationService] Cancelled ${pending.notifications.length} pending notifications.`);
      }
    } catch (e) {
      console.error('[NotificationService] Error cancelling notifications:', e);
    }
  },

  async scheduleSmartRetentionNotifications(user: UserProfile) {
    if (!Capacitor.isNativePlatform()) return;
    
    // Check toggle
    if (user.settings?.notificationsEnabled === false) {
      await this.cancelAll();
      return;
    }

    const hasGranted = await this.init();
    if (!hasGranted) {
      console.log('[NotificationService] Permission denied, skipping scheduling.');
      return;
    }

    try {
      // First clear all existing notifications to avoid duplicate triggers
      await this.cancelAll();

      const dream = user.dream || 'expert';
      const branch = user.branch || 'skills';
      const currentStreak = user.streak || 0;

      const notifications: any[] = [];
      const now = new Date();

      // ── Notification 1: Daily Streak Saver ──
      // Schedule for 7:30 PM today
      const today730 = new Date();
      today730.setHours(19, 30, 0, 0);

      // If 7:30 PM today has already passed, schedule for tomorrow 7:30 PM
      if (today730.getTime() < now.getTime()) {
        today730.setDate(today730.getDate() + 1);
      }

      notifications.push({
        id: 101,
        title: currentStreak > 0 ? "Protect your streak! 🔥" : "Start your daily habit! ⚡",
        body: currentStreak > 0 
          ? `Don't let your ${currentStreak}-day learning streak break. 5 minutes on Kalam Spark today will keep it alive!`
          : `Ready to level up your ${branch}? Spend 5 minutes today to start your learning streak!`,
        schedule: { at: today730 },
        smallIcon: 'ic_stat_name', // fallback to default
        sound: 'default'
      });

      // ── Notification 2: Midday Motivation ──
      // Schedule for tomorrow at 12:30 PM
      const tomorrow1230 = new Date();
      tomorrow1230.setDate(tomorrow1230.getDate() + 1);
      tomorrow1230.setHours(12, 30, 0, 0);

      notifications.push({
        id: 102,
        title: `Your roadmap to ${dream} 🚀`,
        body: `Ready for a quick challenge? Unlock a new milestone in your ${branch} path today.`,
        schedule: { at: tomorrow1230 },
        sound: 'default'
      });

      // ── Notification 3: Inactivity Trigger (Day 2) ──
      // Schedule for 2 days from now at 4:00 PM
      const day2Pm = new Date();
      day2Pm.setDate(day2Pm.getDate() + 2);
      day2Pm.setHours(16, 0, 0, 0);

      notifications.push({
        id: 103,
        title: "Milestone warning 🗺️",
        body: `Your customized roadmap for becoming a ${dream} is waiting. Tap to resume your learning adventure!`,
        schedule: { at: day2Pm },
        sound: 'default'
      });

      // ── Notification 4: Sunday Weekly Analytics Review ──
      // Schedule for the next upcoming Sunday at 10:00 AM
      const nextSunday = new Date();
      const currentDay = nextSunday.getDay(); // 0 is Sunday, 1 is Monday, etc.
      const daysUntilSunday = (7 - currentDay) % 7 || 7; // if today is Sunday, schedule for next Sunday
      nextSunday.setDate(nextSunday.getDate() + daysUntilSunday);
      nextSunday.setHours(10, 0, 0, 0);

      notifications.push({
        id: 104,
        title: "Weekly Analytics Summary 📊",
        body: "Check out your Progress Analytics dashboard to view your subject mastery and study metrics this week!",
        schedule: { at: nextSunday },
        sound: 'default'
      });

      await LocalNotifications.schedule({ notifications });
      console.log(`[NotificationService] Successfully scheduled ${notifications.length} smart retention notifications.`);
      
      // Log scheduled items for debugging
      const list = await LocalNotifications.getPending();
      console.log('[NotificationService] Pending in Capacitor:', list.notifications.map(n => ({
        id: n.id,
        title: n.title,
        trigger: n.schedule
      })));

    } catch (err) {
      console.error('[NotificationService] Error scheduling notifications:', err);
    }
  }
};
