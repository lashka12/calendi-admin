/**
 * Booking Validation Utilities
 * Server-side validation for booking data
 */

/**
 * Validate Israeli phone number format
 * Accepts: 05X-XXXXXXX or 05XXXXXXXX
 */
export function isValidIsraeliPhone(phone: string): boolean {
  if (!phone || typeof phone !== "string") {
    return false;
  }

  // Israeli format: 05X-XXXXXXX or 05XXXXXXXX
  const phoneRegex = /^05[0-9]-?[0-9]{7}$/;
  return phoneRegex.test(phone.trim());
}

/**
 * Validate date is not in the past
 */
export function isValidFutureDate(dateString: string): boolean {
  if (!dateString || typeof dateString !== "string") {
    return false;
  }

  // Parse date string (YYYY-MM-DD)
  const bookingDate = new Date(dateString + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset to start of day

  return bookingDate >= today;
}

/**
 * Validate date format (YYYY-MM-DD)
 */
export function isValidDateFormat(dateString: string): boolean {
  if (!dateString || typeof dateString !== "string") {
    return false;
  }

  const dateRegex = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
  return dateRegex.test(dateString);
}

/**
 * Validate time format (HH:MM)
 */
export function isValidTimeFormat(timeString: string): boolean {
  if (!timeString || typeof timeString !== "string") {
    return false;
  }

  const timeRegex = /^[0-9]{2}:[0-9]{2}$/;
  if (!timeRegex.test(timeString)) {
    return false;
  }

  // Validate hours (00-23) and minutes (00-59)
  const [hours, minutes] = timeString.split(":").map(Number);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

/**
 * Validate all required booking fields are present
 */
export function validateRequiredFields(data: Record<string, any>): {
  valid: boolean;
  missingFields: string[];
} {
  const requiredFields = [
    "clientName",
    "phone",
    "date",
    "time",
    "serviceId",
  ];
  const missingFields: string[] = [];

  for (const field of requiredFields) {
    const value = data[field];
    if (!value || (typeof value === "string" && !value.trim())) {
      missingFields.push(field);
    }
  }

  return {
    valid: missingFields.length === 0,
    missingFields,
  };
}

/**
 * Validate complete booking data
 * Returns detailed error or null if valid
 */
export function validateBookingData(bookingData: Record<string, any>): string | null {
  // Check required fields
  const requiredCheck = validateRequiredFields(bookingData);
  if (!requiredCheck.valid) {
    const fields = requiredCheck.missingFields.join(", ");
    return `Missing required fields: ${fields}`;
  }

  // Validate phone format
  if (!isValidIsraeliPhone(bookingData.phone)) {
    return "Invalid phone number format. Use: 05X-XXXXXXX";
  }

  // Validate date format
  if (!isValidDateFormat(bookingData.date)) {
    return "Invalid date format. Use: YYYY-MM-DD";
  }

  // Validate date is not in past
  if (!isValidFutureDate(bookingData.date)) {
    return "Cannot book appointments in the past";
  }

  // Validate time format
  if (!isValidTimeFormat(bookingData.time)) {
    return "Invalid time format. Use: HH:MM";
  }

  // Validate client name length
  if (bookingData.clientName.trim().length < 2) {
    return "Client name must be at least 2 characters";
  }

  if (bookingData.clientName.trim().length > 100) {
    return "Client name is too long (max 100 characters)";
  }

  // All validations passed
  return null;
}

