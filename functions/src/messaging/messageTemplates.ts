/**
 * ============================================================================
 * WHATSAPP MESSAGE TEMPLATES
 * ============================================================================
 * 
 * Centralized location for all WhatsApp message templates.
 * Supports multiple languages: English (en), Hebrew (he), Arabic (ar)
 * 
 * ============================================================================
 */

// ============================================
// TYPES
// ============================================

export type SupportedLanguage = "en" | "he" | "ar";

export interface BookingData {
  clientName?: string;
  date: string;
  time: string;
  service: string;
}

export interface OTPData {
  code: string;
}

export interface ReminderData {
  clientName?: string;
  date: string;
  time: string;
  service: string;
  dayText: string;
}

// ============================================
// MESSAGE TEMPLATES
// ============================================

export const messageTemplates = {

  // ------------------------------------------
  // BOOKING CONFIRMED
  // ------------------------------------------
  bookingConfirmed: {
    en: (data: BookingData): string => {
      const greeting = data.clientName ? `Hi ${data.clientName},` : "Hi,";
      return `${greeting}

Your appointment is confirmed for *${data.date}* at *${data.time}* for ${data.service}.

Looking forward to seeing you.`;
    },

    he: (data: BookingData): string => {
      const greeting = data.clientName ? `שלום ${data.clientName},` : "שלום,";
      return `${greeting}

התור שלך אושר לתאריך *${data.date}* בשעה *${data.time}* עבור ${data.service}.

מחכים לראותך.`;
    },

    ar: (data: BookingData): string => {
      const greeting = data.clientName ? `مرحبا ${data.clientName},` : "مرحبا,";
      return `${greeting}

تم تأكيد موعدك في *${data.date}* الساعة *${data.time}* لـ ${data.service}.

نتطلع لرؤيتك.`;
    },
  },

  // ------------------------------------------
  // BOOKING UPDATED
  // ------------------------------------------
  bookingUpdated: {
    en: (data: BookingData): string => {
      const greeting = data.clientName ? `Hi ${data.clientName},` : "Hi,";
      return `${greeting}

Your appointment has been updated to *${data.date}* at *${data.time}* for ${data.service}.

If you have any questions, feel free to reach out.`;
    },

    he: (data: BookingData): string => {
      const greeting = data.clientName ? `שלום ${data.clientName},` : "שלום,";
      return `${greeting}

התור שלך עודכן לתאריך *${data.date}* בשעה *${data.time}* עבור ${data.service}.

אם יש לך שאלות, אל תהסס לפנות אלינו.`;
    },

    ar: (data: BookingData): string => {
      const greeting = data.clientName ? `مرحبا ${data.clientName},` : "مرحبا,";
      return `${greeting}

تم تحديث موعدك إلى *${data.date}* الساعة *${data.time}* لـ ${data.service}.

إذا كان لديك أي أسئلة، لا تتردد في التواصل معنا.`;
    },
  },

  // ------------------------------------------
  // BOOKING CANCELLED
  // ------------------------------------------
  bookingCancelled: {
    en: (data: BookingData): string => {
      const greeting = data.clientName ? `Hi ${data.clientName},` : "Hi,";
      return `${greeting}

Your appointment for ${data.service} on *${data.date}* at *${data.time}* has been cancelled.

If you'd like to reschedule, please let us know.`;
    },

    he: (data: BookingData): string => {
      const greeting = data.clientName ? `שלום ${data.clientName},` : "שלום,";
      return `${greeting}

התור שלך ל${data.service} בתאריך *${data.date}* בשעה *${data.time}* בוטל.

אם תרצה לקבוע תור חדש, אנא פנה אלינו.`;
    },

    ar: (data: BookingData): string => {
      const greeting = data.clientName ? `مرحبا ${data.clientName},` : "مرحبا,";
      return `${greeting}

تم إلغاء موعدك لـ ${data.service} في *${data.date}* الساعة *${data.time}*.

إذا كنت ترغب في إعادة الحجز، يرجى إعلامنا.`;
    },
  },

  // ------------------------------------------
  // OTP (Verification Code)
  // ------------------------------------------
  otp: {
    en: (data: OTPData): string => {
      return `Your verification code is *${data.code}*

This code expires in 5 minutes.

Do not share this code with anyone.`;
    },

    he: (data: OTPData): string => {
      return `קוד האימות שלך הוא *${data.code}*

הקוד תקף ל-5 דקות.

אל תשתף את הקוד עם אף אחד.`;
    },

    ar: (data: OTPData): string => {
      return `رمز التحقق الخاص بك هو *${data.code}*

ينتهي هذا الرمز خلال 5 دقائق.

لا تشارك هذا الرمز مع أي شخص.`;
    },
  },

  // ------------------------------------------
  // DAILY REMINDER
  // ------------------------------------------
  dailyReminder: {
    en: (data: ReminderData): string => {
      const greeting = data.clientName ? `Hi ${data.clientName},` : "Hi,";
      const appointmentText = data.dayText 
        ? `your appointment ${data.dayText}` 
        : `your upcoming appointment on ${data.date}`;
      return `${greeting}

This is a reminder about ${appointmentText}:

Date: ${data.date}
Time: ${data.time}
Service: ${data.service}

We look forward to seeing you.

If you need to reschedule, please contact us as soon as possible.`;
    },

    he: (data: ReminderData): string => {
      const greeting = data.clientName ? `שלום ${data.clientName},` : "שלום,";
      const appointmentText = data.dayText 
        ? `לתור שלך ${data.dayText}` 
        : `לתור שלך בתאריך ${data.date}`;
      return `${greeting}

זוהי תזכורת ${appointmentText}:

תאריך: ${data.date}
שעה: ${data.time}
שירות: ${data.service}

מחכים לראותך.

אם אתה צריך לשנות את התור, אנא צור איתנו קשר בהקדם האפשרי.`;
    },

    ar: (data: ReminderData): string => {
      const greeting = data.clientName ? `مرحبا ${data.clientName},` : "مرحبا,";
      const appointmentText = data.dayText 
        ? `بموعدك ${data.dayText}` 
        : `بموعدك في ${data.date}`;
      return `${greeting}

هذا تذكير ${appointmentText}:

التاريخ: ${data.date}
الوقت: ${data.time}
الخدمة: ${data.service}

نتطلع لرؤيتك.

إذا كنت بحاجة إلى إعادة جدولة الموعد، يرجى الاتصال بنا في أقرب وقت ممكن.`;
    },
  },
};

// ============================================
// HELPER: GET MESSAGE BY LANGUAGE
// ============================================

type MessageKey = keyof typeof messageTemplates;
type MessageData<K extends MessageKey> = Parameters<typeof messageTemplates[K]["en"]>[0];

/**
 * Get a message in the specified language
 * Falls back to English if translation not found
 */
export function getMessage<K extends MessageKey>(
  key: K,
  lang: SupportedLanguage,
  data: MessageData<K>
): string {
  const template = messageTemplates[key];
  const fn = template[lang] || template["en"];
  return fn(data as any);
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Format a date string for display in messages
 * Converts "2026-01-12" to "Sunday, January 12"
 */
export function formatDateForMessage(dateStr: string, lang: SupportedLanguage = "en"): string {
  const dateObj = new Date(dateStr + "T00:00:00");
  
  const localeMap: Record<SupportedLanguage, string> = {
    en: "en-US",
    he: "he-IL",
    ar: "ar-SA",
  };
  
  return dateObj.toLocaleDateString(localeMap[lang], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/**
 * Format time for display (24h format)
 * Ensures consistent "HH:MM" format (e.g., "09:30", "14:30")
 */
export function formatTimeForMessage(timeStr: string): string {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}
