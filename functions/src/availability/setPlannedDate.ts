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

/**
 * Set planned date with custom time slots
 * Checks for bookings before allowing changes
 */
export const setPlannedDate = onCall(
  {
    enforceAppCheck: false,
  },
  async (request) => {
    const { date, slots } = request.data as {
      date: string;
      slots: TimeSlot[];
    };

    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "You must be logged in to set planned date"
      );
    }

    if (!date) {
      throw new HttpsError(
        "invalid-argument",
        "Date is required"
      );
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      throw new HttpsError(
        "invalid-argument",
        "Invalid date format. Use YYYY-MM-DD"
      );
    }

    // Validate date is not in past
    const inputDate = new Date(date + "T00:00:00Z");
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (inputDate < today) {
      throw new HttpsError(
        "invalid-argument",
        "Cannot plan dates in the past"
      );
    }

    // Validate slots
    if (!Array.isArray(slots)) {
      throw new HttpsError(
        "invalid-argument",
        "Slots must be an array"
      );
    }

    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    
    // Get slot duration from settings
    const db = admin.firestore();
    const slotDuration = await getSlotDuration(db);
    
    for (const slot of slots) {
      if (!slot.start || !slot.end) {
        throw new HttpsError(
          "invalid-argument",
          "Each slot must have start and end times"
        );
      }
      if (!timeRegex.test(slot.start) || !timeRegex.test(slot.end)) {
        throw new HttpsError(
          "invalid-argument",
          `Invalid time format. Use HH:MM (24-hour format)`
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
          alignment.error || "Time range must align with slot duration boundaries"
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
          "Start time must be before end time"
        );
      }
    }

    try {
      // Get existing planned date to check for removed slots
      const plannedRef = db.collection("plannedDates");
      const existingQuery = plannedRef.where("date", "==", date);
      const existingSnapshot = await existingQuery.get();

      let existingSlots: TimeSlot[] = [];
      if (!existingSnapshot.empty) {
        const existingDoc = existingSnapshot.docs[0];
        existingSlots = existingDoc.data().slots || [];
      }

      // Check for bookings in removed time slots
      if (existingSlots.length > 0 && slots.length < existingSlots.length) {
        // Find removed slots
        const removedSlots = existingSlots.filter(
          (existingSlot) =>
            !slots.some(
              (newSlot) =>
                newSlot.start === existingSlot.start &&
                newSlot.end === existingSlot.end
            )
        );

        // Check bookings for removed slots
        for (const removedSlot of removedSlots) {
          const sessionsRef = db.collection("sessions");
          const sessionsQuery = sessionsRef
            .where("date", "==", date)
            .where("status", "in", ["approved", "pending"]);
          const sessionsSnapshot = await sessionsQuery.get();

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
              `Cannot remove time slot ${removedSlot.start}-${removedSlot.end} on ${date}. There are existing bookings in this time range. Please cancel or reschedule bookings first.`
            );
          }
        }
      }

      // Save planned date
      if (existingSnapshot.empty) {
        await plannedRef.add({
          date,
          slots,
          createdAt: FieldValue.serverTimestamp(),
          createdBy: request.auth.uid,
        });
      } else {
        const docRef = existingSnapshot.docs[0].ref;
        await docRef.update({
          slots,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: request.auth.uid,
        });
      }

      console.log(`✅ Planned date ${date} updated by ${request.auth.uid}`);

      return {
        success: true,
        message: "Planned date updated successfully",
      };
    } catch (error: any) {
      if (error instanceof HttpsError) {
        throw error;
      }
      console.error("❌ Failed to set planned date:", error.message);
      throw new HttpsError(
        "internal",
        "Failed to save planned date. Please try again."
      );
    }
  }
);

/**
 * Delete planned date
 * Checks for bookings before allowing deletion
 */
export const deletePlannedDate = onCall(
  {
    enforceAppCheck: false,
  },
  async (request) => {
    const { date } = request.data as { date: string };

    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "You must be logged in to delete planned date"
      );
    }

    if (!date) {
      throw new HttpsError(
        "invalid-argument",
        "Date is required"
      );
    }

    try {
      const db = admin.firestore();

      // Check for bookings on this date
      const sessionsRef = db.collection("sessions");
      const sessionsQuery = sessionsRef
        .where("date", "==", date)
        .where("status", "in", ["approved", "pending"]);
      const sessionsSnapshot = await sessionsQuery.get();

      const pendingRef = db.collection("pendingBookings");
      const pendingQuery = pendingRef.where("date", "==", date);
      const pendingSnapshot = await pendingQuery.get();

      const totalBookings = sessionsSnapshot.size + pendingSnapshot.size;

      if (totalBookings > 0) {
        throw new HttpsError(
          "failed-precondition",
          `Cannot delete planned date ${date}. There are ${totalBookings} existing booking(s). Please cancel or reschedule bookings first.`
        );
      }

      // Delete planned date
      const plannedRef = db.collection("plannedDates");
      const existingQuery = plannedRef.where("date", "==", date);
      const existingSnapshot = await existingQuery.get();

      if (!existingSnapshot.empty) {
        await existingSnapshot.docs[0].ref.delete();
      }

      console.log(`✅ Planned date ${date} deleted by ${request.auth.uid}`);

      return {
        success: true,
        message: "Planned date deleted successfully",
      };
    } catch (error: any) {
      if (error instanceof HttpsError) {
        throw error;
      }
      console.error("❌ Failed to delete planned date:", error.message);
      throw new HttpsError(
        "internal",
        "Failed to delete planned date. Please try again."
      );
    }
  }
);

