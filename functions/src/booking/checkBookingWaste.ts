import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { getSlotDuration, calculateSlotsNeeded } from "../utils/slotHelpers";

/**
 * Check booking waste/buffer time for a specific date or all dates
 * Returns detailed analysis of service duration vs booked duration
 */
export const checkBookingWaste = onCall(
  {
    enforceAppCheck: false,
  },
  async (request) => {
    try {
      const { date } = request.data as { date?: string };
      const db = admin.firestore();

      // Get slot duration
      const slotDuration = await getSlotDuration(db);

      // Get all sessions
      const sessionsRef = db.collection("sessions");
      const sessionsQuery = date
        ? sessionsRef.where("date", "==", date)
        : sessionsRef;
      const sessionsSnapshot = await sessionsQuery.get();

      // Get all pending bookings
      const pendingRef = db.collection("pendingBookings");
      const pendingQuery = date
        ? pendingRef.where("date", "==", date)
        : pendingRef;
      const pendingSnapshot = await pendingQuery.get();

      const bookings: any[] = [];
      let totalServiceDuration = 0;
      let totalBookedDuration = 0;
      let totalWaste = 0;

      // Process sessions
      sessionsSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        const serviceDuration = data.duration || 60;
        const slotsNeeded = calculateSlotsNeeded(serviceDuration, slotDuration);
        const bookedDuration = slotsNeeded * slotDuration;
        const waste = bookedDuration - serviceDuration;

        totalServiceDuration += serviceDuration;
        totalBookedDuration += bookedDuration;
        totalWaste += waste;

        bookings.push({
          id: doc.id,
          type: "session",
          date: data.date,
          time: data.time,
          endTime: data.endTime,
          service: data.service || "N/A",
          serviceDuration,
          bookedDuration,
          slotsNeeded,
          waste,
        });
      });

      // Process pending bookings
      pendingSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        const serviceDuration = data.duration || 60;
        const slotsNeeded = calculateSlotsNeeded(serviceDuration, slotDuration);
        const bookedDuration = slotsNeeded * slotDuration;
        const waste = bookedDuration - serviceDuration;

        totalServiceDuration += serviceDuration;
        totalBookedDuration += bookedDuration;
        totalWaste += waste;

        bookings.push({
          id: doc.id,
          type: "pending",
          date: data.date,
          time: data.time,
          endTime: data.endTime,
          service: data.service || "N/A",
          serviceDuration,
          bookedDuration,
          slotsNeeded,
          waste,
        });
      });

      // Group by date
      const bookingsByDate: { [key: string]: any[] } = {};
      bookings.forEach((booking) => {
        if (!bookingsByDate[booking.date]) {
          bookingsByDate[booking.date] = [];
        }
        bookingsByDate[booking.date].push(booking);
      });

      return {
        success: true,
        slotDuration,
        totalBookings: bookings.length,
        totalServiceDuration,
        totalBookedDuration,
        totalWaste,
        wastePercentage:
          totalBookedDuration > 0
            ? (totalWaste / totalBookedDuration) * 100
            : 0,
        averageWastePerBooking:
          bookings.length > 0 ? totalWaste / bookings.length : 0,
        bookings,
        bookingsByDate,
      };
    } catch (error: any) {
      console.error("❌ Failed to check booking waste:", error.message);
      throw new HttpsError(
        "internal",
        "Failed to check booking waste. Please try again."
      );
    }
  }
);




