import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

/**
 * Check if a date has existing bookings (sessions or pending bookings)
 * Used to prevent blocking days with bookings
 */
export const checkBookingsForDate = onCall(
  {
    enforceAppCheck: false,
  },
  async (request) => {
    const { date } = request.data as { date: string };

    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "You must be logged in to check bookings"
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

    try {
      const db = admin.firestore();

      // Check sessions (approved bookings)
      const sessionsRef = db.collection("sessions");
      const sessionsQuery = sessionsRef
        .where("date", "==", date)
        .where("status", "in", ["approved", "pending"]);
      const sessionsSnapshot = await sessionsQuery.get();

      // Check pending bookings
      const pendingRef = db.collection("pendingBookings");
      const pendingQuery = pendingRef.where("date", "==", date);
      const pendingSnapshot = await pendingQuery.get();

      const sessions = sessionsSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          clientName: data.clientName as string,
          time: data.time as string,
          service: data.service as string,
        };
      });

      const pendingBookings = pendingSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          clientName: data.clientName as string,
          time: data.time as string,
          service: data.service as string,
        };
      });

      const totalBookings = sessions.length + pendingBookings.length;

      return {
        hasBookings: totalBookings > 0,
        count: totalBookings,
        sessions,
        pendingBookings,
      };
    } catch (error: any) {
      console.error("❌ Failed to check bookings:", error.message);
      throw new HttpsError(
        "internal",
        "Failed to check bookings. Please try again."
      );
    }
  }
);

/**
 * Check if a time range has existing bookings
 * Used to prevent removing time slots with bookings
 */
export const checkBookingsForTimeRange = onCall(
  {
    enforceAppCheck: false,
  },
  async (request) => {
    const { date, startTime, endTime } = request.data as {
      date: string;
      startTime: string;
      endTime: string;
    };

    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "You must be logged in to check bookings"
      );
    }

    if (!date || !startTime || !endTime) {
      throw new HttpsError(
        "invalid-argument",
        "Date, startTime, and endTime are required"
      );
    }

    // Validate formats
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;

    if (!dateRegex.test(date) || !timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      throw new HttpsError(
        "invalid-argument",
        "Invalid date or time format"
      );
    }

    try {
      const db = admin.firestore();

      // Convert times to minutes for comparison
      const [startHour, startMin] = startTime.split(":").map(Number);
      const [endHour, endMin] = endTime.split(":").map(Number);
      const rangeStartMinutes = startHour * 60 + startMin;
      const rangeEndMinutes = endHour * 60 + endMin;

      // Helper to check if booking overlaps with time range
      const overlaps = (bookingTime: string, bookingEndTime?: string, bookingDuration?: number): boolean => {
        const [bHour, bMin] = bookingTime.split(":").map(Number);
        const bookingStartMinutes = bHour * 60 + bMin;
        
        let bookingEndMinutes: number;
        if (bookingEndTime) {
          const [eHour, eMin] = bookingEndTime.split(":").map(Number);
          bookingEndMinutes = eHour * 60 + eMin;
        } else if (bookingDuration) {
          bookingEndMinutes = bookingStartMinutes + bookingDuration;
        } else {
          // Default 60 minutes if no end time or duration
          bookingEndMinutes = bookingStartMinutes + 60;
        }

        // Check if booking overlaps with range
        return (
          (bookingStartMinutes >= rangeStartMinutes && bookingStartMinutes < rangeEndMinutes) ||
          (bookingEndMinutes > rangeStartMinutes && bookingEndMinutes <= rangeEndMinutes) ||
          (bookingStartMinutes <= rangeStartMinutes && bookingEndMinutes >= rangeEndMinutes)
        );
      };

      // Check sessions
      const sessionsRef = db.collection("sessions");
      const sessionsQuery = sessionsRef
        .where("date", "==", date)
        .where("status", "in", ["approved", "pending"]);
      const sessionsSnapshot = await sessionsQuery.get();

      // Check pending bookings
      const pendingRef = db.collection("pendingBookings");
      const pendingQuery = pendingRef.where("date", "==", date);
      const pendingSnapshot = pendingQuery.get();

      const overlappingSessions = sessionsSnapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .filter((s: any) => overlaps(s.time, s.endTime, s.duration));

      const overlappingPending = (await pendingSnapshot).docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .filter((p: any) => overlaps(p.time, p.endTime, p.duration));

      const totalOverlapping = overlappingSessions.length + overlappingPending.length;

      return {
        hasBookings: totalOverlapping > 0,
        count: totalOverlapping,
        sessions: overlappingSessions.map((s: any) => ({
          id: s.id,
          clientName: s.clientName,
          time: s.time,
          endTime: s.endTime,
          service: s.service,
        })),
        pendingBookings: overlappingPending.map((p: any) => ({
          id: p.id,
          clientName: p.clientName,
          time: p.time,
          endTime: p.endTime,
          service: p.service,
        })),
      };
    } catch (error: any) {
      console.error("❌ Failed to check bookings for time range:", error.message);
      throw new HttpsError(
        "internal",
        "Failed to check bookings. Please try again."
      );
    }
  }
);

