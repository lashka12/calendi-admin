# Firebase Cloud Functions

This directory contains all Firebase Cloud Functions for the Calendi project.

## Structure

```
functions/
├── src/
│   ├── booking/          # Booking-related functions
│   │   ├── createBooking.ts
│   │   └── validators.ts
│   ├── notifications/    # Notification triggers
│   │   ├── bookingConfirmation.ts
│   │   ├── bookingUpdate.ts
│   │   └── bookingCancellation.ts
│   ├── otp/              # OTP verification
│   │   ├── sendOTP.ts
│   │   └── verifyOTP.ts
│   ├── slots/            # Availability management
│   │   └── setAvailableSlots.ts
│   ├── messaging/        # WhatsApp messaging
│   │   ├── sendCustomWhatsApp.ts
│   │   └── whatsAppService.ts
│   └── utils/            # Shared utilities
│       └── helpers.ts
├── index.ts              # Barrel file - exports all functions
├── package.json
└── tsconfig.json
```

## Functions

### Callable Functions (5)
1. **createBooking** - Creates pending bookings with validation
2. **sendCustomWhatsApp** - Admin sends custom WhatsApp messages
3. **sendOTPWhatsApp** - Sends OTP via WhatsApp (with rate limiting)
4. **verifyOTPWhatsApp** - Verifies OTP codes
5. **setAvailableSlots** - Admin sets available time slots

### Firestore Triggers (3)
6. **sendBookingConfirmation** - Triggers when session is created
7. **sendBookingUpdateWhatsApp** - Triggers when session is updated
8. **sendBookingCancellationWhatsApp** - Triggers when session is deleted

## Development

### Install Dependencies
```bash
cd functions
npm install
```

### Build TypeScript
```bash
npm run build
```

### Run Locally with Emulators
```bash
npm run serve
```

### Deploy
```bash
npm run deploy
```

## Notes

- All functions are written in TypeScript
- Functions are organized by feature/domain
- Each function is in its own file for maintainability
- Shared utilities are in `/src/utils/`
- WhatsApp service is in `/src/messaging/`





