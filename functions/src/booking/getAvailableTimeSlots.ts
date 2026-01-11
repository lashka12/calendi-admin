import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import {
  getSlotDuration,
  generateSlotsInRange,
  calculateSlotsNeeded,
  isTimeAlignedWithSlots,
} from "../utils/slotHelpers";
import {
  getBusinessTimezone,
  isPastDateInTimezone,
  isTodayInTimezone,
  isPastTimeInTimezone,
} from "../utils/helpers";

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
 * Get available time slots for a specific date (public - no authentication required)
 * Used by client booking interface
 * 
 * Algorithm:
 * 1. Validate date is not in the past (return empty if past)
 * 2. Check special days (if closed, return empty)
 * 3. Check planned dates (if exists, use those slots)
 * 4. Fall back to weekly template
 * 5. Get slot duration from settings
 * 6. Generate slots from ranges using slot duration
 * 7. Get booked times (round up service duration to slots)
 * 8. Filter out booked times and past times if today
 * 9. If serviceId provided, filter slots where the service fits before working hours end
 * 
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} [serviceId] - Optional service ID (looks up duration to filter slots that can fit)
 * @param {string} [excludeSessionId] - Optional session ID to exclude from booked times (for editing existing sessions)
 */
export const getAvailableTimeSlots = onCall(
  {
    enforceAppCheck: false,
  },
  async (request) => {
    const { date, serviceId, excludeSessionId } = request.data as { 
      date: string; 
      serviceId?: string;
      excludeSessionId?: string;
    };

    if (!date) {
      throw new HttpsError("invalid-argument", "Date is required");
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      throw new HttpsError(
        "invalid-argument",
        "Invalid date format. Use YYYY-MM-DD"
      );
    }

    // Note: We'll validate date after getting timezone from settings

    try {
      const db = admin.firestore();

      // Get business timezone first (needed for all timezone-aware checks)
      const timezone = await getBusinessTimezone(db);

      // Look up service duration if serviceId provided
      let serviceDuration: number | undefined;
      if (serviceId) {
        const serviceDoc = await db.collection("services").doc(serviceId).get();
        if (serviceDoc.exists) {
          const serviceData = serviceDoc.data();
          serviceDuration = serviceData?.duration;
          console.log(`📋 [getAvailableTimeSlots] Service ${serviceId} has duration: ${serviceDuration} min`);
        } else {
          console.error(`❌ [getAvailableTimeSlots] Service ${serviceId} not found`);
          throw new HttpsError(
            "not-found",
            "Service not found. Please select a valid service."
          );
        }
      }

      // Validate date is not in the past (timezone-aware)
      if (isPastDateInTimezone(date, timezone)) {
        return {
          success: true,
          date,
          slots: [],
          reason: "past_date",
        };
      }

      // 1. Check special days (highest priority)
      const specialDaysRef = db.collection("specialDays");
      const specialSnapshot = await specialDaysRef.get();
      
      const specialDays = specialSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const isClosed = specialDays.some(
        (sd: any) => sd.dates?.includes(date) && sd.isClosed
      );

      if (isClosed) {
        return {
          success: true,
          date,
          slots: [],
          reason: "closed",
        };
      }

      // 2. Check planned dates (medium priority)
      const plannedRef = db.collection("plannedDates");
      const plannedQuery = plannedRef.where("date", "==", date);
      const plannedSnapshot = await plannedQuery.get();

      let availableSlots: TimeSlot[] = [];

      if (!plannedSnapshot.empty) {
        // Use planned date slots
        const plannedData = plannedSnapshot.docs[0].data();
        availableSlots = plannedData.slots || [];
      } else {
        // 3. Fall back to weekly template (lowest priority)
        const templateRef = db.collection("settings").doc("weeklyTemplate");
        const templateDoc = await templateRef.get();

        if (templateDoc.exists) {
          const template = templateDoc.data() as WeeklyTemplate;
          const dateObj = new Date(date + "T00:00:00");
          const dayOfWeek = dateObj.getDay();
          const dayNames = [
            "sunday",
            "monday",
            "tuesday",
            "wednesday",
            "thursday",
            "friday",
            "saturday",
          ];
          const dayName = dayNames[dayOfWeek] as keyof WeeklyTemplate;
          availableSlots = template[dayName] || [];
        }
      }

      if (availableSlots.length === 0) {
        return {
          success: true,
          date,
          slots: [],
          reason: "no_availability",
        };
      }

      // 4. Get slot duration from settings
      const slotDuration = await getSlotDuration(db);

      // 5. Generate slots from time ranges using slot duration
      const allTimeSlots: string[] = [];
      for (const slot of availableSlots) {
        const slots = generateSlotsInRange(slot.start, slot.end, slotDuration);
        allTimeSlots.push(...slots);
      }

      // Remove duplicates and sort
      const uniqueSlots = [...new Set(allTimeSlots)].sort();

      // 6. Get booked times (using slot duration for rounding)
      // Pass excludeSessionId to exclude the session being edited
      const bookedTimes = await getBookedTimes(db, date, slotDuration, excludeSessionId);

      // 7. Filter out booked times and past times (if today) - timezone-aware
      const isTodayDate = isTodayInTimezone(date, timezone);

      let availableTimes = uniqueSlots.filter((slotTime) => {
        // Skip if not aligned with slot boundaries (shouldn't happen, but safety check)
        if (!isTimeAlignedWithSlots(slotTime, slotDuration)) {
          return false;
        }

        // Skip if booked
        if (bookedTimes.has(slotTime)) {
          return false;
        }

        // Skip if past time and today (timezone-aware)
        if (isTodayDate && isPastTimeInTimezone(slotTime, timezone)) {
          return false;
        }

        return true;
      });

      // 8. If serviceDuration provided, filter slots that can fit the service
      if (serviceDuration && serviceDuration > 0) {
        const slotsNeeded = calculateSlotsNeeded(serviceDuration, slotDuration);
        const serviceEndDuration = slotsNeeded * slotDuration;
        
        availableTimes = availableTimes.filter((slotTime) => {
          // Calculate end time for this service starting at this slot
          const endTime = calculateEndTime(slotTime, serviceEndDuration);
          
          // Check if service fits within available time ranges
          const fitsInRange = availableSlots.some((range) => {
            const rangeStart = timeToMinutes(range.start);
            const rangeEnd = timeToMinutes(range.end);
            const slotStart = timeToMinutes(slotTime);
            const slotEnd = timeToMinutes(endTime);
            
            // Service fits if it starts and ends within this range
            return slotStart >= rangeStart && slotEnd <= rangeEnd;
          });
          
          if (!fitsInRange) {
            return false;
          }
          
          // Check if all required slots are available (not booked)
          const requiredSlots = generateSlotsInRange(slotTime, endTime, slotDuration);
          const allSlotsAvailable = requiredSlots.every((slot) => 
            !bookedTimes.has(slot) && uniqueSlots.includes(slot)
          );
          
          return allSlotsAvailable;
        });
      }

      return {
        success: true,
        date,
        slots: availableTimes,
        totalAvailable: availableTimes.length,
      };
    } catch (error: any) {
      console.error("❌ Failed to get available time slots:", error.message);
      throw new HttpsError(
        "internal",
        "Failed to load available time slots. Please try again."
      );
    }
  }
);


/**
 * Get booked times for a date
 * Rounds up service duration to full slots
 * @param excludeSessionId - Optional session ID to exclude (for editing existing sessions)
 */
async function getBookedTimes(
  db: admin.firestore.Firestore,
  date: string,
  slotDuration: number,
  excludeSessionId?: string
): Promise<Set<string>> {
  const bookedTimes = new Set<string>();
  const { calculateSlotsNeeded } = await import("../utils/slotHelpers");

  console.log(`🔍 [getBookedTimes] Checking booked times for ${date} with slotDuration: ${slotDuration}${excludeSessionId ? `, excluding session: ${excludeSessionId}` : ''}`);

  // Get sessions (approved bookings)
  const sessionsRef = db.collection("sessions");
  const sessionsQuery = sessionsRef
    .where("date", "==", date)
    .where("status", "in", ["approved", "pending"]);
  const sessionsSnapshot = await sessionsQuery.get();

  console.log(`📊 [getBookedTimes] Found ${sessionsSnapshot.size} sessions`);

  sessionsSnapshot.docs.forEach((doc) => {
    // Skip the session being edited
    if (excludeSessionId && doc.id === excludeSessionId) {
      console.log(`  ⏭️ Skipping excluded session ${doc.id}`);
      return;
    }

    const data = doc.data();
    const startTime = data.time;
    const duration = data.duration || 60; // Default 60 minutes
    
    // Round up to full slots
    const slotsNeeded = calculateSlotsNeeded(duration, slotDuration);
    const totalDuration = slotsNeeded * slotDuration;
    const endTime = calculateEndTime(startTime, totalDuration);

    // Add all slots in this booking range
    const slots = generateSlotsInRange(startTime, endTime, slotDuration);
    console.log(`  📅 Session ${doc.id}: ${startTime}-${endTime} (${duration}min → ${slotsNeeded} slots): ${slots.join(", ")}`);
    slots.forEach((slot) => bookedTimes.add(slot));
  });

  // Get pending bookings
  const pendingRef = db.collection("pendingBookings");
  const pendingQuery = pendingRef.where("date", "==", date);
  const pendingSnapshot = await pendingQuery.get();

  console.log(`📊 [getBookedTimes] Found ${pendingSnapshot.size} pending bookings`);

  pendingSnapshot.docs.forEach((doc) => {
    const data = doc.data();
    const startTime = data.time;
    const duration = data.duration || 60;
    
    // Round up to full slots
    const slotsNeeded = calculateSlotsNeeded(duration, slotDuration);
    const totalDuration = slotsNeeded * slotDuration;
    const endTime = calculateEndTime(startTime, totalDuration);

    const slots = generateSlotsInRange(startTime, endTime, slotDuration);
    console.log(`  📅 Pending ${doc.id}: ${startTime}-${endTime} (${duration}min → ${slotsNeeded} slots): ${slots.join(", ")}`);
    slots.forEach((slot) => bookedTimes.add(slot));
  });

  console.log(`✅ [getBookedTimes] Total booked slots: ${bookedTimes.size}`);
  return bookedTimes;
}

/**
 * Calculate end time from start time and duration
 */
function calculateEndTime(startTime: string, durationMinutes: number): string {
  const [hours, minutes] = startTime.split(":").map(Number);
  const startDate = new Date();
  startDate.setHours(hours, minutes, 0, 0);

  const endDate = new Date(startDate.getTime() + durationMinutes * 60000);
  const endHours = endDate.getHours().toString().padStart(2, "0");
  const endMinutes = endDate.getMinutes().toString().padStart(2, "0");

  return `${endHours}:${endMinutes}`;
}

/**
 * Convert time string to minutes since midnight
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

