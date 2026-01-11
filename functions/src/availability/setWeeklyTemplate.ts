import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import {
  getSlotDuration,
  validateTimeRangeAlignment,
} from "../utils/slotHelpers";

interface TimeSlot {
  start: string; // HH:MM
  end: string; // HH:MM
}

interface WeeklyTemplate {
  monday?: TimeSlot[];
  tuesday?: TimeSlot[];
  wednesday?: TimeSlot[];
  thursday?: TimeSlot[];
  friday?: TimeSlot[];
  saturday?: TimeSlot[];
  sunday?: TimeSlot[];
}

/**
 * Set weekly template schedule
 * Validates time slots and checks for bookings before allowing changes
 */
export const setWeeklyTemplate = onCall(
  {
    enforceAppCheck: false,
  },
  async (request) => {
    const { template } = request.data as { template: WeeklyTemplate };

    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "You must be logged in to set weekly template"
      );
    }

    if (!template) {
      throw new HttpsError(
        "invalid-argument",
        "Template is required"
      );
    }

    // Validate that template has at least one day with slots
    const daysOfWeek = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    let hasAnySlots = false;
    
    for (const day of daysOfWeek) {
      const slots = template[day as keyof WeeklyTemplate];
      if (slots && Array.isArray(slots) && slots.length > 0) {
        hasAnySlots = true;
        break;
      }
    }
    
    if (!hasAnySlots) {
      throw new HttpsError(
        "invalid-argument",
        "Weekly template must have at least one day with time slots"
      );
    }

    // Validate time slot format and alignment with slot duration
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;

    // Get slot duration from settings
    const db = admin.firestore();
    const slotDuration = await getSlotDuration(db);

    for (const day of daysOfWeek) {
      const slots = template[day as keyof WeeklyTemplate];
      if (slots && Array.isArray(slots)) {
        for (const slot of slots) {
          if (!slot.start || !slot.end) {
            throw new HttpsError(
              "invalid-argument",
              `Invalid slot for ${day}: start and end are required`
            );
          }
          if (!timeRegex.test(slot.start) || !timeRegex.test(slot.end)) {
            throw new HttpsError(
              "invalid-argument",
              `Invalid time format for ${day}. Use HH:MM (24-hour format)`
            );
          }
          
          // Validate alignment with slot duration
          const alignment = validateTimeRangeAlignment(
            slot.start,
            slot.end,
            slotDuration
          );
          if (!alignment.valid) {
            throw new HttpsError(
              "invalid-argument",
              `${day}: ${alignment.error}`
            );
          }
          
          // Validate start < end
          const [startHour, startMin] = slot.start.split(":").map(Number);
          const [endHour, endMin] = slot.end.split(":").map(Number);
          const startMinutes = startHour * 60 + startMin;
          const endMinutes = endHour * 60 + endMin;
          if (startMinutes >= endMinutes) {
            throw new HttpsError(
              "invalid-argument",
              `Invalid time range for ${day}: start time must be before end time`
            );
          }
        }
      }
    }

    try {
      const db = admin.firestore();

      // Get existing template to check for removed slots
      const templateRef = db.collection("settings").doc("weeklyTemplate");
      const existingDoc = await templateRef.get();
      const existingTemplate = existingDoc.exists ? existingDoc.data() as WeeklyTemplate : {};

      // Check for bookings in removed time slots (if template exists)
      if (existingDoc.exists) {
        const today = new Date();
        const nextWeek = new Date(today);
        nextWeek.setDate(today.getDate() + 7);

        // Check each day for removed slots
        for (const day of daysOfWeek) {
          const existingSlots = existingTemplate[day as keyof WeeklyTemplate] || [];
          const newSlots = template[day as keyof WeeklyTemplate] || [];

          // Find removed slots (in existing but not in new)
          const removedSlots = existingSlots.filter(
            (existingSlot) =>
              !newSlots.some(
                (newSlot) =>
                  newSlot.start === existingSlot.start &&
                  newSlot.end === existingSlot.end
              )
          );

          // Check bookings for removed slots in next 7 days
          for (const removedSlot of removedSlots) {
            // Check each day in the next week that matches this day of week
            for (let i = 0; i < 7; i++) {
              const checkDate = new Date(today);
              checkDate.setDate(today.getDate() + i);
              const dayOfWeekIndex = checkDate.getDay();
              const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
              const checkDayName = dayNames[dayOfWeekIndex];

              if (checkDayName === day) {
                const dateStr = checkDate.toISOString().split("T")[0];
                
                // Check for bookings in this time range
                const sessionsRef = db.collection("sessions");
                const sessionsQuery = sessionsRef
                  .where("date", "==", dateStr)
                  .where("status", "in", ["approved", "pending"]);
                const sessionsSnapshot = await sessionsQuery.get();

                // Check if any booking overlaps with removed slot
                const hasOverlapping = sessionsSnapshot.docs.some((doc) => {
                  const session = doc.data();
                  const [sessionHour, sessionMin] = session.time.split(":").map(Number);
                  const sessionStart = sessionHour * 60 + sessionMin;
                  const sessionEnd = session.endTime
                    ? (() => {
                        const [eHour, eMin] = session.endTime.split(":").map(Number);
                        return eHour * 60 + eMin;
                      })()
                    : sessionStart + (session.duration || 60);

                  const [slotStartHour, slotStartMin] = removedSlot.start.split(":").map(Number);
                  const [slotEndHour, slotEndMin] = removedSlot.end.split(":").map(Number);
                  const slotStart = slotStartHour * 60 + slotStartMin;
                  const slotEnd = slotEndHour * 60 + slotEndMin;

                  return (
                    (sessionStart >= slotStart && sessionStart < slotEnd) ||
                    (sessionEnd > slotStart && sessionEnd <= slotEnd) ||
                    (sessionStart <= slotStart && sessionEnd >= slotEnd)
                  );
                });

                if (hasOverlapping) {
                  throw new HttpsError(
                    "failed-precondition",
                    `Cannot remove time slot ${removedSlot.start}-${removedSlot.end} on ${day}. There are existing bookings in this time range. Please cancel or reschedule bookings first.`
                  );
                }
              }
            }
          }
        }
      }

      // Save template
      await templateRef.set(
        {
          ...template,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: request.auth.uid,
        },
        { merge: true }
      );

      console.log(`✅ Weekly template updated by ${request.auth.uid}`);

      return {
        success: true,
        message: "Weekly template updated successfully",
      };
    } catch (error: any) {
      if (error instanceof HttpsError) {
        throw error;
      }
      console.error("❌ Failed to set weekly template:", error.message);
      throw new HttpsError(
        "internal",
        "Failed to save weekly template. Please try again."
      );
    }
  }
);

