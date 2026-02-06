import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { getTodayDateString } from "../utils/helpers";

/**
 * Create a new session (Admin only)
 * Validates that the session is not in the past before creating
 * Provides centralized logging and validation
 */
export const createSession = onCall(
  {
    enforceAppCheck: false,
  },
  async (request) => {
    console.log("📅 [createSession] Function called");

    // 🔒 SECURITY: Require authentication
    if (!request.auth) {
      console.log("🚫 [createSession] Unauthorized attempt to create session");
      throw new HttpsError(
        "unauthenticated",
        "You must be logged in as admin to create sessions"
      );
    }

    console.log(`👤 [createSession] Admin ${request.auth.uid} creating session`);

    try {
      const db = admin.firestore();

      // Extract session data
      const {
        clientName,
        phone,
        email,
        service,
        serviceId,
        date,
        time,
        duration,
        endTime,
        notes,
        amount,
      } = request.data as {
        clientName: string;
        phone: string;
        email?: string;
        service: string;
        serviceId?: string; // Reference to service document for multi-language lookups
        date: string; // YYYY-MM-DD
        time: string; // HH:MM
        duration?: number; // in minutes
        endTime?: string; // HH:MM
        notes?: string;
        amount?: string | number;
      };

      console.log("📋 [createSession] Data received:", {
        clientName,
        phone,
        service,
        serviceId,
        date,
        time,
        duration,
        endTime,
      });

      // ✅ VALIDATION 1: Check required fields
      if (!clientName || !phone || !service || !date || !time) {
        console.log("❌ [createSession] Missing required fields");
        throw new HttpsError(
          "invalid-argument",
          "clientName, phone, service, date, and time are required"
        );
      }

      // ✅ VALIDATION 2: Validate date format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(date)) {
        console.log(`❌ [createSession] Invalid date format: ${date}`);
        throw new HttpsError(
          "invalid-argument",
          "Invalid date format. Use YYYY-MM-DD"
        );
      }

      // ✅ VALIDATION 3: Validate time format (HH:MM)
      const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(time)) {
        console.log(`❌ [createSession] Invalid time format: ${time}`);
        throw new HttpsError(
          "invalid-argument",
          "Invalid time format. Use HH:MM (24-hour format)"
        );
      }

      // ✅ VALIDATION 4: Validate phone format (Israeli)
      const phoneRegex = /^0[2-9]\d{7,8}$/;
      if (!phoneRegex.test(phone.replace(/-/g, ""))) {
        console.log(`❌ [createSession] Invalid phone format: ${phone}`);
        throw new HttpsError(
          "invalid-argument",
          "Invalid phone number format. Use Israeli format (05X-XXXXXXX)"
        );
      }

      // ✅ VALIDATION 5: Validate that session is not in the past (timezone-safe)
      const today = getTodayDateString();
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      
      let isPast = false;
      if (date < today) {
        isPast = true;
      } else if (date === today) {
        isPast = time < currentTime;
      }
      
      console.log(`🕐 [createSession] Time validation check:`, {
        date,
        time,
        today,
        currentTime,
        isPast,
        dateComparison: date < today ? 'past' : date === today ? 'today' : 'future',
        timeComparison: date === today ? (time < currentTime ? 'past' : 'future') : 'N/A',
      });
      
      if (isPast) {
        const reason = date < today 
          ? 'date is in the past' 
          : `time ${time} is before current time ${currentTime}`;
        console.log(
          `❌ [createSession] Attempt to create session in the past: ${date} ${time} (${reason})`
        );
        throw new HttpsError(
          "failed-precondition",
          `Cannot create sessions in the past: ${date} ${time}`
        );
      }

      console.log("✅ [createSession] All validations passed");

      // ✅ VALIDATION 6: Validate duration if provided (must be divisible by 15 for security rules)
      let validatedDuration = duration || 60; // Default to 60 minutes
      if (validatedDuration % 15 !== 0) {
        // Round to nearest 15-minute increment
        validatedDuration = Math.round(validatedDuration / 15) * 15;
        if (validatedDuration <= 0) validatedDuration = 15; // Minimum 15 minutes
        console.log(
          `⚠️ [createSession] Duration rounded to ${validatedDuration} minutes (must be divisible by 15)`
        );
      }

      // ✅ VALIDATION 7: Calculate or validate endTime
      let validatedEndTime = endTime;
      if (!validatedEndTime) {
        // Calculate endTime from time and duration
        const [hours, minutes] = time.split(":").map(Number);
        const startDate = new Date();
        startDate.setHours(hours, minutes, 0, 0);
        const endDate = new Date(
          startDate.getTime() + validatedDuration * 60000
        );
        const endHours = endDate.getHours().toString().padStart(2, "0");
        const endMinutes = endDate.getMinutes().toString().padStart(2, "0");
        validatedEndTime = `${endHours}:${endMinutes}`;
        console.log(
          `📊 [createSession] Calculated endTime: ${validatedEndTime} (from ${time} + ${validatedDuration}min)`
        );
      }

      // Build session data with ALL required fields for security rules
      const sessionData: any = {
        clientName: clientName.trim(),
        phone: phone.trim(),
        service: service.trim(),
        date,
        time,
        endTime: validatedEndTime,
        duration: validatedDuration,
        status: "approved",
        createdAt: Timestamp.now(),
      };

      // Add serviceId for multi-language service name lookups
      if (serviceId) sessionData.serviceId = serviceId;

      // Add optional fields if provided
      if (email) sessionData.email = email.trim();
      if (notes) sessionData.notes = notes.trim();
      if (amount !== undefined) sessionData.amount = amount;

      console.log("💾 [createSession] Creating session in Firestore...");

      // Create session in Firestore
      const sessionsRef = db.collection("sessions");
      const docRef = await sessionsRef.add(sessionData);

      console.log(
        `✅ [createSession] Session created successfully: ${docRef.id}`
      );
      console.log(`📅 [createSession] Session details: ${clientName} - ${date} ${time}`);

      return {
        success: true,
        sessionId: docRef.id,
        message: "Session created successfully",
      };
    } catch (error: any) {
      console.error("❌ [createSession] Error:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError(
        "internal",
        "An error occurred while creating the session"
      );
    }
  }
);

