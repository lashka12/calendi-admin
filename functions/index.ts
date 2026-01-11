import { setGlobalOptions } from "firebase-functions/v2";
import * as admin from "firebase-admin";

// Set global options
setGlobalOptions({ maxInstances: 10 });

// Initialize Firebase Admin
admin.initializeApp();

// ============================================
// BOOKING FUNCTIONS
// ============================================
export { createPendingRequest } from "./src/booking/createPendingRequest";
export { createSession } from "./src/booking/createSession";
export { getServices } from "./src/booking/getServices";
export { getAvailableTimeSlots } from "./src/booking/getAvailableTimeSlots";
export { getAvailableDatesInRange } from "./src/booking/getAvailableDatesInRange";
export { checkBookingWaste } from "./src/booking/checkBookingWaste";

// ============================================
// NOTIFICATION FUNCTIONS
// ============================================
export { sendBookingConfirmation } from "./src/notifications/bookingConfirmation";
export { sendBookingUpdateWhatsApp } from "./src/notifications/bookingUpdate";
export { sendBookingCancellationWhatsApp } from "./src/notifications/bookingCancellation";
export { sendDailyReminders } from "./src/notifications/dailyReminder";

// ============================================
// OTP FUNCTIONS
// ============================================
export { sendOTPWhatsApp } from "./src/otp/sendOTP";
export { verifyOTPWhatsApp } from "./src/otp/verifyOTP";

// ============================================
// MESSAGING FUNCTIONS
// ============================================
export { sendCustomWhatsApp } from "./src/messaging/sendCustomWhatsApp";

// ============================================
// SLOTS FUNCTIONS
// ============================================
export { setAvailableSlots } from "./src/slots/setAvailableSlots";

// ============================================
// AVAILABILITY FUNCTIONS
// ============================================
export { checkBookingsForDate, checkBookingsForTimeRange } from "./src/availability/checkBookings";
export { setWeeklyTemplate } from "./src/availability/setWeeklyTemplate";
export { setPlannedDate, deletePlannedDate } from "./src/availability/setPlannedDate";
export { setSpecialDay, deleteSpecialDay } from "./src/availability/setSpecialDay";
export { generateWeeklySlots } from "./src/availability/generateWeeklySlots";


