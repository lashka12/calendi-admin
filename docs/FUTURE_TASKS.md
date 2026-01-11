# Future Tasks & Items to Address

This document tracks items that need to be addressed later, improvements, and technical debt.

---

## 🔒 Security & IP Blocking

### Unknown IP Check Reversion
- **Status**: Pending
- **Priority**: High
- **Description**: Revert the unknown IP check that was removed for local testing
- **Context**: IP blocking functionality was disabled to allow local testing with emulators
- **Action Required**: 
  - Re-enable unknown IP check after testing is complete
  - Ensure it works correctly with production Firebase
  - Test that legitimate users aren't blocked
- **Related**: IP blocking/security features

### Firebase App Check
- **Status**: Disabled (Development)
- **Priority**: Medium (Before Production)
- **Description**: Enable Firebase App Check for additional security layer
- **Current Status**: 
  - All functions have `enforceAppCheck: false`
  - Intentionally disabled for development/testing
  - `data_check` 404 requests in console are harmless (Firebase checking for App Check config)
- **Why Disabled**:
  - Easier to test without App Check setup
  - Some functions are public (no auth required)
  - App Check requires Firebase Console configuration
  - Emulator compatibility during development
- **Action Required** (Before Production):
  1. Set up App Check in Firebase Console
  2. Choose provider (reCAPTCHA v3 for web apps)
  3. Change `enforceAppCheck: false` to `true` in all functions
  4. Test thoroughly with App Check enabled
  5. Verify public functions still work correctly
- **Benefits**:
  - Protects against abuse and bot traffic
  - Prevents quota exhaustion from unauthorized clients
  - Additional security layer beyond authentication
- **Note**: Current security (Auth + Security Rules + Validation) is sufficient for now, but App Check adds extra protection

---

## 📋 Booking System Improvements

### Real-Time Slot Updates for Clients
- **Status**: Pending
- **Priority**: Medium
- **Description**: Implement real-time updates for available slots in client booking app
- **Current Issue**: 
  - Clients call `getAvailableTimeSlots` Cloud Function (one-time call)
  - If a booking is created or admin adds/removes slots, clients won't see changes until refresh
  - No real-time updates for clients (they must manually refresh)
- **Context**: 
  - Clients can't read directly from Firestore (security - they must use Cloud Functions)
  - Cloud Functions are one-time calls, not real-time
  - `getAvailableTimeSlots` calculates slots dynamically from `sessions`, `pendingBookings`, `plannedDates`, etc.
- **Possible Solutions**:
  1. **Polling**: Call `getAvailableTimeSlots` every X seconds (simple but inefficient)
  2. **Computed Slots Collection**: Create a denormalized `computedAvailableSlots` collection that updates when bookings change, allow clients to read it with `onSnapshot` (better performance)
  3. **Real-time Cloud Function**: Use Firebase Realtime Database or WebSockets (complex)
  4. **Hybrid**: Allow clients to read `sessions` and `pendingBookings` for specific date only (exposes some data but enables real-time)
- **Recommendation**: Option 2 (Computed Slots Collection) - best balance of security and real-time updates
- **Note**: This is a UX improvement, not critical - clients can refresh to see updates

### Duplicate Booking Prevention
- **Status**: Accepted Risk (Admin handles duplicates)
- **Priority**: Low
- **Description**: Race condition where two users can create pending bookings for the same slot
- **Context**: `validateSlotForBooking` checks for collisions, but there's a race condition window between check and create
- **Current Solution**: Admin manually rejects duplicate pending bookings
- **Note**: Discussed - decided to keep simple approach. Admin can handle rare duplicates. More complex solutions (transactions, locks) add complexity without significant benefit.

### Smart Slot Ranking
- **Status**: Pending
- **Priority**: Low
- **Description**: Show "best" slots first (minimize waste), then "Show More" for all slots
- **Context**: To reduce waste time by guiding users to slots that fit better
- **Approach**:
  - Calculate waste for each slot
  - Rank: zero waste → minimal waste → earlier time
  - Show top 5-10 as "Recommended"
  - "Show All" button for complete list
- **Note**: User wants to handle this later

---

## 🧹 Cleanup & Maintenance

### Expired Pending Bookings Cleanup
- **Status**: Pending
- **Priority**: Medium
- **Description**: Auto-cleanup abandoned pending bookings (e.g., user didn't complete OTP)
- **Context**: If user abandons booking after OTP, pending booking stays in DB
- **Approach**:
  - Scheduled function to delete pending bookings older than 30 minutes
  - Or check expiration when fetching available slots
- **Note**: Prevents abandoned bookings from blocking slots

### Booking Waste Analysis
- **Status**: Implemented (Function exists)
- **Priority**: Low
- **Description**: `checkBookingWaste` function created but needs UI integration
- **Context**: Function calculates waste/buffer time for bookings
- **Action**: Create admin dashboard view to show waste analysis

---

## 🚀 Performance & Optimization

### Slot Calculation Caching
- **Status**: Pending
- **Priority**: Low
- **Description**: Cache calculated slots to reduce Cloud Function calls
- **Context**: Currently slots are calculated on every request
- **Approach**: Cache slots per date with TTL, invalidate on booking changes
- **Note**: May not be needed if real-time updates are implemented

---

## 📝 Documentation

### API Documentation
- **Status**: Pending
- **Priority**: Low
- **Description**: Create comprehensive API documentation for all Cloud Functions
- **Context**: Functions are documented in code but need centralized API docs
- **Action**: Document all callable functions with parameters, returns, examples

---

## 🐛 Known Issues

### Race Condition in Booking Creation
- **Status**: Accepted (Low Priority)
- **Priority**: Low
- **Description**: Two users can create pending bookings for same slot simultaneously
- **Impact**: Admin has to manually reject one
- **Solution**: Accepted as-is. Admin handles rare duplicates. More complex solutions add unnecessary complexity.
- **Mitigation**: Comprehensive validation prevents most issues. Race condition window is very small.

---

## 🔄 Refactoring

### Remove Direct Firestore Reads from Old App
- **Status**: Completed
- **Priority**: ✅ Done
- **Description**: Old app (`business-management`) migrated to use Cloud Functions
- **Context**: 
  - Migrated `getAvailableSlotsForDate` to use `getAvailableTimeSlots` Cloud Function
  - Migrated booking creation to use `createPendingRequest` Cloud Function
  - Removed separate `verifyOTP` call - now integrated into `createPendingRequest`
- **Date Completed**: 2025-12-19

---

## 📅 Future Enhancements

### Reservation System
- **Status**: Discussed
- **Priority**: Low
- **Description**: Temporary reservation system when user selects slot (5-10 min hold)
- **Context**: Prevents slot from being taken while user fills booking form
- **Approach**: Create `reservations` collection with expiration
- **Note**: May not be needed if duplicate prevention is implemented

### Bulk Operations
- **Status**: Future Consideration
- **Priority**: Low
- **Description**: Bulk planning, bulk approval/rejection of bookings
- **Context**: Admin efficiency improvements
- **Note**: Not in initial scope

---

## ⚠️ Important Notes

- **IP Blocking**: Must be re-enabled before production deployment
- **Testing**: All changes should be tested with Firebase emulators first
- **Security**: Review security rules after implementing new features
- **Performance**: Monitor Cloud Function execution times and costs

---

## ✅ Recently Completed (2025-12-19)

### OTP Verification Integration
- **Status**: ✅ Completed
- **Description**: Integrated OTP verification into `createPendingRequest`
- **Changes**: 
  - `createPendingRequest` now verifies OTP internally before creating booking
  - OTP code is required parameter
  - OTP is deleted after successful verification (one-time use)
  - Function renamed from `createBooking` to `createPendingRequest`

### Comprehensive Validation System
- **Status**: ✅ Completed
- **Description**: Created shared validation service for consistent validation
- **Changes**:
  - Created `slotValidationService.ts` with `validateSlotForBooking()` function
  - Validates time alignment, availability windows, service fit, collisions
  - Used by both `getAvailableTimeSlots` (filtering) and `createPendingRequest` (validation)
  - Prevents bypass attempts and ensures security

### Time Alignment Validation
- **Status**: ✅ Completed
- **Description**: Enforce time alignment with slot boundaries
- **Changes**:
  - All booking times must align with slot boundaries (e.g., :00, :15, :30, :45 for 15-min slots)
  - Misaligned times are rejected
  - Prevents collision detection bugs from misaligned slot arrays
  - `getAvailableTimeSlots` filters out misaligned slots

### Bug Fixes
- **Status**: ✅ Completed
- **Description**: Fixed business hours validation bug
- **Changes**: Business hours check now uses `bookingDuration` (rounded) instead of `serviceDuration`

## 🌍 Timezone Issues (Critical)

### Past-Time Validation Timezone Problems
- **Status**: Documented - Awaiting Implementation
- **Priority**: High
- **Description**: Multiple functions have timezone-dependent past-time validation that fails when server timezone differs from user/business timezone
- **Affected Functions**:
  1. `createSession` - Can create sessions for past times
  2. `getAvailableTimeSlots` - Returns past time slots for today
  3. `setPlannedDate` - Can add planned dates with past times
  4. `setAvailableSlots` - Can set slots for past times
  5. `createPendingRequest` - Can create bookings for past times
  6. `slotValidationService` - Validation fails due to timezone mismatch
- **Root Cause**: Comparing user's local time (as string) with server's local time (different timezones)
- **Why Deployment Won't Fix**: Firebase Functions run in specific regions (UTC-X), while business/users may be in different timezones
- **Solution**: Implement timezone-aware validation (see `docs/TIMEZONE_ISSUES.md` for details)
- **Documentation**: See `docs/TIMEZONE_ISSUES.md` for complete analysis and solution plan

---

**Last Updated**: 2025-12-19  
**Maintained By**: Development Team




