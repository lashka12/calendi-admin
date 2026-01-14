import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import { sendWhatsAppMessage } from "../messaging/whatsAppService";
import { getMessage, formatTimeForMessage, SupportedLanguage } from "../messaging/messageTemplates";
import { getCurrentBusinessTime, isPastTimeInTimezone } from "../utils/helpers";

/**
 * ============================================================================
 * DAILY REMINDER - WhatsApp Notification
 * ============================================================================
 * 
 * Sends WhatsApp reminders to clients about their upcoming appointments.
 * 
 * HOW IT WORKS:
 * - Runs every hour (to allow dynamic configuration)
 * - Checks settings/notifications for enabled flag and desired hour
 * - If current hour matches and enabled, sends reminders
 * - Queries sessions for the target date (default: tomorrow)
 * 
 * SETTINGS STRUCTURE (Firestore: settings/notifications):
 * {
 *   dailyReminder: {
 *     enabled: true,
 *     hour: 22,        // 24-hour format (22 = 10 PM)
 *     daysBefore: 1    // 1 = tomorrow, 0 = same day
 *   }
 * }
 * 
 * ============================================================================
 */

interface DailyReminderSettings {
  enabled: boolean;
  hour: number;
  daysBefore: number;
}

interface NotificationSettings {
  dailyReminder?: DailyReminderSettings;
}

/**
 * Get current hour in a specific timezone
 */
function getCurrentHourInTimezone(timezone: string): number {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    hour12: false,
  });
  const hourStr = formatter.format(now);
  return parseInt(hourStr, 10);
}

/**
 * Get a date string (YYYY-MM-DD) for N days from now in a specific timezone
 */
function getDateInTimezone(timezone: string, daysFromNow: number): string {
  const now = new Date();
  now.setDate(now.getDate() + daysFromNow);
  
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  
  return formatter.format(now); // Returns YYYY-MM-DD
}

/**
 * Get localized "day text" for reminders
 * - 0 days = "today"
 * - 1 day = "tomorrow"  
 * - 2+ days = empty (will show date instead)
 */
function getDayText(daysBefore: number, lang: SupportedLanguage): string {
  if (daysBefore === 0) {
    return { en: "today", he: "היום", ar: "اليوم" }[lang];
  }
  if (daysBefore === 1) {
    return { en: "tomorrow", he: "מחר", ar: "غدا" }[lang];
  }
  // For 2+ days, return empty - the message will show the date instead
  return "";
}

/**
 * Scheduled function that runs every hour to check if reminders should be sent
 */
export const sendDailyReminders = onSchedule(
  {
    schedule: "0 * * * *", // Every hour at minute 0
    timeZone: "Asia/Jerusalem", // Base timezone for scheduling
    secrets: ["ULTRAMSG_INSTANCE_ID", "ULTRAMSG_TOKEN"],
    timeoutSeconds: 300, // 5 minutes max
    memory: "256MiB",
  },
  async (event) => {
    const db = admin.firestore();

    console.log("⏰ [dailyReminder] Scheduled function triggered");

    try {
      // ========================================
      // 1. LOAD SETTINGS
      // ========================================
      
      const [notificationsDoc, businessSettingsDoc] = await Promise.all([
        db.collection("settings").doc("notifications").get(),
        db.collection("settings").doc("businessSettings").get(),
      ]);

      // Get notification settings
      const notificationSettings = notificationsDoc.exists
        ? (notificationsDoc.data() as NotificationSettings)
        : {};
      
      const dailyReminder = notificationSettings.dailyReminder || {
        enabled: false,
        hour: 22,
        daysBefore: 1,
      };

      // Check if reminders are enabled
      if (!dailyReminder.enabled) {
        console.log("⏸️ [dailyReminder] Reminders are disabled in settings");
        return;
      }

      // Get business timezone
      const businessSettings = businessSettingsDoc.exists
        ? businessSettingsDoc.data()
        : {};
      const timezone = businessSettings?.timezone || "Asia/Jerusalem";

      // ========================================
      // 2. CHECK IF IT'S THE RIGHT TIME
      // ========================================

      const currentHour = getCurrentHourInTimezone(timezone);
      const targetHour = dailyReminder.hour;

      console.log(`🕐 [dailyReminder] Current hour: ${currentHour}, Target hour: ${targetHour} (${timezone})`);

      if (currentHour !== targetHour) {
        console.log(`⏭️ [dailyReminder] Not reminder time yet (${currentHour} !== ${targetHour})`);
        return;
      }

      console.log("✅ [dailyReminder] It's reminder time! Proceeding to send...");

      // ========================================
      // 3. GET TARGET DATE & SESSIONS
      // ========================================

      const targetDate = getDateInTimezone(timezone, dailyReminder.daysBefore);
      console.log(`📅 [dailyReminder] Looking for sessions on: ${targetDate}`);

      const sessionsSnapshot = await db.collection("sessions")
        .where("date", "==", targetDate)
        .where("status", "==", "approved")
        .get();

      if (sessionsSnapshot.empty) {
        console.log(`📭 [dailyReminder] No approved sessions found for ${targetDate}`);
        return;
      }

      console.log(`📋 [dailyReminder] Found ${sessionsSnapshot.size} sessions to remind`);

      // ========================================
      // 4. SEND REMINDERS
      // ========================================

      let successCount = 0;
      let failCount = 0;
      let skippedPast = 0;

      // Get current time for same-day filtering (using existing helper)
      const { time: currentTime } = getCurrentBusinessTime(timezone);
      const isSameDay = dailyReminder.daysBefore === 0;

      for (const doc of sessionsSnapshot.docs) {
        const session = doc.data();
        
        // Skip if no phone number
        if (!session.phone) {
          console.warn(`⚠️ [dailyReminder] Session ${doc.id} has no phone number`);
          failCount++;
          continue;
        }

        // For same-day reminders, skip sessions that have already passed
        if (isSameDay && session.time && isPastTimeInTimezone(session.time, timezone)) {
          console.log(`⏭️ [dailyReminder] Skipping past session ${doc.id} at ${session.time} (current time: ${currentTime})`);
          skippedPast++;
          continue;
        }

        try {
          // TODO: Get language from settings when multi-lang is implemented
          const lang = "en";
          
          // Build dayText based on daysBefore
          const dayText = getDayText(dailyReminder.daysBefore, lang);
          const message = getMessage("dailyReminder", lang, {
            clientName: session.clientName,
            date: session.date,
            time: formatTimeForMessage(session.time),
            service: session.service || "Your appointment",
            dayText,
          });

          await sendWhatsAppMessage(session.phone, message);
          
          console.log(`✅ [dailyReminder] Sent reminder to ${session.phone} for session ${doc.id}`);
          successCount++;

          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (error: any) {
          console.error(`❌ [dailyReminder] Failed to send to ${session.phone}:`, error.message);
          failCount++;
        }
      }

      // ========================================
      // 5. LOG SUMMARY
      // ========================================

      console.log(`📊 [dailyReminder] Complete! Sent: ${successCount}, Failed: ${failCount}, Skipped (past): ${skippedPast}`);

      // Optionally: Store reminder log
      await db.collection("logs").add({
        type: "dailyReminder",
        date: targetDate,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        stats: {
          total: sessionsSnapshot.size,
          sent: successCount,
          failed: failCount,
          skippedPast,
        },
      });

    } catch (error: any) {
      console.error("❌ [dailyReminder] Function failed:", error.message);
      throw error;
    }
  }
);
