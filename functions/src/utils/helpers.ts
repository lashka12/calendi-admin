import * as admin from "firebase-admin";

/**
 * Utility helper functions
 */

/**
 * Calculate end time given a start time and duration
 * @param startTime - Start time in HH:MM format
 * @param duration - Duration in minutes
 * @returns End time in HH:MM format
 */
export function calculateEndTime(startTime: string, duration: number): string {
  const [hours, minutes] = startTime.split(":").map(Number);
  const totalMinutes = hours * 60 + minutes + duration;

  const endHours = Math.floor(totalMinutes / 60) % 24;
  const endMinutes = totalMinutes % 60;

  const formattedHours = String(endHours).padStart(2, "0");
  const formattedMinutes = String(endMinutes).padStart(2, "0");

  return `${formattedHours}:${formattedMinutes}`;
}

/**
 * Convert time string to minutes since midnight
 * @param timeStr - Time in HH:MM format
 * @returns Minutes since midnight
 */
export function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Get today's date string in local timezone (YYYY-MM-DD)
 * Avoids timezone issues with UTC conversion
 * @deprecated Use getTodayDateStringInTimezone() for business timezone support
 */
export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Check if a date string is in the past (date-only comparison)
 * @param dateStr - Date in YYYY-MM-DD format
 * @returns true if date is before today
 * @deprecated Use isPastDateInTimezone() for business timezone support
 */
export function isPastDate(dateStr: string): boolean {
  const today = getTodayDateString();
  return dateStr < today;
}

/**
 * Check if a date is today (date-only comparison)
 * @param dateStr - Date in YYYY-MM-DD format
 * @returns true if date is today
 * @deprecated Use isTodayInTimezone() for business timezone support
 */
export function isToday(dateStr: string): boolean {
  const today = getTodayDateString();
  return dateStr === today;
}

/**
 * Create a Date object from date and time strings in local timezone
 * Avoids timezone shift issues when parsing date strings
 * @param dateStr - Date in YYYY-MM-DD format
 * @param timeStr - Time in HH:MM format
 * @returns Date object in local timezone
 */
export function createLocalDateTime(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

/**
 * Check if a booking datetime is in the past
 * Compares date/time strings directly to avoid timezone issues
 * @param dateStr - Date in YYYY-MM-DD format
 * @param timeStr - Time in HH:MM format
 * @returns true if the datetime is in the past
 * @deprecated Use isPastDateTimeInTimezone() for business timezone support
 */
export function isPastDateTime(dateStr: string, timeStr: string): boolean {
  const today = getTodayDateString();
  
  // If date is in the past (date-only comparison), it's definitely in the past
  if (dateStr < today) {
    return true;
  }
  
  // If date is in the future, it's not in the past
  if (dateStr > today) {
    return false;
  }
  
  // If date is today, compare times directly (string comparison works for HH:MM format)
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  
  return timeStr < currentTime;
}

/**
 * Check if a time slot is in the past (for today's date)
 * @param timeStr - Time in HH:MM format
 * @returns true if the time is in the past
 * @deprecated Use isPastTimeInTimezone() for business timezone support
 */
export function isPastTime(timeStr: string): boolean {
  const now = new Date();
  const [hours, minutes] = timeStr.split(':').map(Number);
  const slotTime = new Date();
  slotTime.setHours(hours, minutes, 0, 0);
  return slotTime <= now;
}

// ============================================================================
// TIMEZONE-AWARE UTILITY FUNCTIONS
// ============================================================================
// These functions use the business timezone from Firestore settings
// to correctly handle date/time comparisons regardless of server location.

/**
 * Get business timezone from Firestore settings
 * @param db - Firestore database instance
 * @returns Promise<string> - IANA timezone string (e.g., "Asia/Jerusalem")
 */
export async function getBusinessTimezone(db: admin.firestore.Firestore): Promise<string> {
  try {
    const settingsDoc = await db.collection("settings").doc("businessSettings").get();
    if (settingsDoc.exists) {
      const data = settingsDoc.data();
      if (data?.timezone && typeof data.timezone === "string") {
        return data.timezone;
      }
    }
    // Default to Asia/Jerusalem if not set
    return "Asia/Jerusalem";
  } catch (error) {
    console.warn("Failed to get business timezone from settings, using default:", error);
    return "Asia/Jerusalem";
  }
}

/**
 * Get current time in business timezone
 * Uses Intl.DateTimeFormat for accurate timezone conversion
 * @param timezone - IANA timezone string (e.g., "Asia/Jerusalem")
 * @returns Object with { date: "YYYY-MM-DD", time: "HH:MM" }
 */
export function getCurrentBusinessTime(timezone: string): { date: string; time: string } {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const year = parts.find((p) => p.type === "year")?.value || "";
  const month = parts.find((p) => p.type === "month")?.value || "";
  const day = parts.find((p) => p.type === "day")?.value || "";
  const hour = parts.find((p) => p.type === "hour")?.value || "";
  const minute = parts.find((p) => p.type === "minute")?.value || "";
  return {
    date: `${year}-${month}-${day}`,
    time: `${hour}:${minute}`,
  };
}

/**
 * Get today's date string in business timezone (YYYY-MM-DD)
 * @param timezone - IANA timezone string (e.g., "Asia/Jerusalem")
 * @returns Date string in YYYY-MM-DD format
 */
export function getTodayDateStringInTimezone(timezone: string): string {
  const { date } = getCurrentBusinessTime(timezone);
  return date;
}

/**
 * Check if a time slot is in the past (for today's date) in business timezone
 * @param timeStr - Time in HH:MM format (assumed to be in business timezone)
 * @param timezone - IANA timezone string (e.g., "Asia/Jerusalem")
 * @returns true if the time is in the past
 */
export function isPastTimeInTimezone(timeStr: string, timezone: string): boolean {
  const { time: currentTime } = getCurrentBusinessTime(timezone);
  // String comparison works for HH:MM format (e.g., "11:30" < "13:25")
  return timeStr < currentTime;
}

/**
 * Check if a booking datetime is in the past in business timezone
 * @param dateStr - Date in YYYY-MM-DD format (assumed to be in business timezone)
 * @param timeStr - Time in HH:MM format (assumed to be in business timezone)
 * @param timezone - IANA timezone string (e.g., "Asia/Jerusalem")
 * @returns true if the datetime is in the past
 */
export function isPastDateTimeInTimezone(dateStr: string, timeStr: string, timezone: string): boolean {
  const today = getTodayDateStringInTimezone(timezone);
  // If date is in the past (date-only comparison), it's definitely in the past
  if (dateStr < today) {
    return true;
  }
  // If date is in the future, it's not in the past
  if (dateStr > today) {
    return false;
  }
  // If date is today, compare times directly (string comparison works for HH:MM format)
  return isPastTimeInTimezone(timeStr, timezone);
}

/**
 * Check if a date string is in the past in business timezone
 * @param dateStr - Date in YYYY-MM-DD format (assumed to be in business timezone)
 * @param timezone - IANA timezone string (e.g., "Asia/Jerusalem")
 * @returns true if date is before today
 */
export function isPastDateInTimezone(dateStr: string, timezone: string): boolean {
  const today = getTodayDateStringInTimezone(timezone);
  return dateStr < today;
}

/**
 * Check if a date is today in business timezone
 * @param dateStr - Date in YYYY-MM-DD format (assumed to be in business timezone)
 * @param timezone - IANA timezone string (e.g., "Asia/Jerusalem")
 * @returns true if date is today
 */
export function isTodayInTimezone(dateStr: string, timezone: string): boolean {
  const today = getTodayDateStringInTimezone(timezone);
  return dateStr === today;
}
