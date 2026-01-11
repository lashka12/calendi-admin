# Calendi

An interactive demo of the Calendi booking and business management system.

## Features

- 📊 **Dashboard** - Overview with stats, charts, and today's schedule
- 📅 **Calendar** - Interactive calendar for managing appointments
- 👥 **Clients** - Client management system
- ⏰ **Requests** - Handle booking requests with notifications
- 💼 **Services** - Manage services and offerings
- ⚙️ **Settings** - Configure business settings
- 🚫 **Blacklist** - Manage blocked clients
- 🕐 **Availability** - Set available time slots

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3002](http://localhost:3002) in your browser

## Local Development with Emulators

To test Firebase functions and data locally without affecting production:

1. Start Firebase Emulators:
```bash
npm run emulators
```

2. Start your app with emulators enabled:
```bash
NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true npm run dev
```

See [docs/EMULATOR_SETUP.md](./docs/EMULATOR_SETUP.md) for detailed instructions.

## Project Structure

```
calendi/
├── app/                    # Next.js app router
│   ├── components/         # Reusable UI components
│   ├── lib/                # Utilities and services
│   │   ├── firebase/      # Firebase service functions
│   │   └── hooks/         # Custom React hooks
│   └── [pages]/           # Route pages
├── docs/                   # Documentation
│   └── EMULATOR_SETUP.md  # Firebase Emulators guide
├── functions/              # Firebase Cloud Functions (future)
├── firebase.json          # Firebase configuration
└── firestore.rules        # Firestore security rules
```

## Available Routes

- `/login` - Login page
- `/` - Dashboard (home)
- `/calendar` - Calendar view
- `/clients` - Client management
- `/requests` - Booking requests
- `/services` - Service management
- `/availability` - Availability settings
- `/blacklist` - Blacklist management
- `/settings` - Settings page

## Tech Stack

- Next.js 14
- TypeScript
- Tailwind CSS
- Framer Motion
- Recharts (for data visualization)
- Lucide React (icons)

## Performance Optimizations

- Dynamic imports for heavy components (charts)
- Optimized page transitions
- Splash screen shown only once per session
- Minimal animation overhead
