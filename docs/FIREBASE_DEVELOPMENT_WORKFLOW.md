# Firebase Development Workflow - Complete Guide

This guide explains how to work with this project, including setting up emulators, seeding data, and daily development workflows.

---

## 🚀 Quick Start (First Time Setup)

### 1. Install Dependencies

```bash
# Install app dependencies
npm install

# Install Firebase Functions dependencies
cd functions
npm install
cd ..
```

### 2. Build Functions (First Time)

```bash
cd functions
npm run build
cd ..
```

This compiles TypeScript functions to JavaScript. **Note:** The `emulators:start` script now builds functions automatically, but you may need to build manually if you make changes to function code.

### 3. Start Emulators (Empty)

```bash
npm run emulators:start
```

This automatically builds functions and starts:
- ✅ Firestore emulator (port 8080)
- ✅ Auth emulator (port 9099)
- ✅ Functions emulator (port 5001)
- ✅ Emulator UI (port 4000) - Open http://localhost:4000

**Keep this terminal running!**

### 4. Seed Initial Data

In a **new terminal** (while emulators are running):

```bash
npm run seed
```

This sets up:
- **3 services** from `data/seed/services.json` (Manicure, Pedicure, Gel Manicure)
- **Admin user** (admin@test.com / admin123)

### 5. Export Emulator State

```bash
npm run emulators:export
```

This saves the current emulator state (including the seeded services) to `data/emulator/`.

### 6. Start Your App

In another **new terminal**:

```bash
npm run dev
```

Your app will automatically connect to the emulators! 🎉

---

## 📋 Daily Development Workflow

### Morning Setup (2 Steps)

```bash
# Terminal 1: Start emulators (auto-imports exported data)
npm run emulators

# Terminal 2: Start your app
npm run dev
```

**That's it!** Your app automatically uses emulators - no configuration needed.

### What Happens Automatically

1. **Emulators start** → Load exported data from `data/emulator/`
2. **App starts** → Detects development mode
3. **Auto-connects** → App connects to local emulators
4. **Ready to develop** → All Firebase calls go to emulators

### During Development

1. Edit code (app or functions)
2. Save file
3. Changes are live immediately
4. Test in browser (http://localhost:3002)
5. View logs in Terminal 1 (where emulators are running)
6. View data in Emulator UI (http://localhost:4000)

---

## 🔧 Available Commands

### Emulator Commands

```bash
# Start emulators with exported data (recommended for daily use)
npm run emulators

# Start emulators fresh (no imported data)
npm run emulators:start

# Export current emulator state
npm run emulators:export

# Clear all data and start fresh
npm run emulators:reset
```

### Seed Commands

```bash
# Seed data to emulator (services + admin user)
npm run seed

# Seed data to production Firebase (⚠️ use with caution)
npm run seed:production
```

**What gets seeded:**
- 3 services from `data/seed/services.json`
- Admin user: `admin@test.com` / `admin123`

### App Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Lint code
npm run lint
```

---

## 📁 Project Structure

```
calendi/
├── app/                      # Next.js application
│   ├── lib/firebase/         # Firebase client services
│   │   ├── config.ts         # Auto-detects dev mode → uses emulators
│   │   ├── auth.ts           # Authentication functions
│   │   ├── services.ts      # Services CRUD
│   │   ├── sessions.ts      # Sessions/bookings
│   │   ├── requests.ts      # Pending bookings
│   │   └── blacklist.ts     # Blacklist management
│   └── [pages]/              # App pages
├── functions/                # Firebase Cloud Functions
│   ├── src/                  # TypeScript source code
│   └── lib/                  # Compiled JavaScript
├── data/                     # All data files
│   ├── seed/                 # Seed data (version controlled)
│   │   ├── services.json    # Initial services data
│   │   └── seedData.js      # Seed script
│   └── emulator/            # Exported emulator state (git-ignored)
├── firebase.json             # Firebase configuration
└── firestore.rules           # Firestore security rules
```

---

## 🌱 Working with Seed Data

### Understanding Seed Data

- **Location**: `/data/seed/` folder (version controlled in git)
- **Purpose**: Initial test data for development
- **Format**: JSON files (e.g., `services.json`)

### Seeding Workflow

#### First Time (After Fresh Start)

```bash
# 1. Start emulators (empty)
npm run emulators:start

# 2. Seed data
npm run seed

# 3. Export state
npm run emulators:export
```

#### Daily Use (Recommended)

```bash
# Just start emulators - they auto-import exported data
npm run emulators
```

The exported data includes all your seeded services, so you don't need to reseed every time.

#### When You Need Fresh Data

```bash
# Option 1: Clear everything and reseed
npm run emulators:reset  # Clears data/emulator/
npm run seed             # Add services
npm run emulators:export # Save state

# Option 2: Just reseed (if emulators already running)
npm run seed
```

### Adding More Seed Data

1. **Create JSON file** in `/data/seed/` folder:
   ```json
   {
     "users": [...],
     "sessions": [...]
   }
   ```

2. **Create seed script** in `/data/seed/` folder (similar to existing `seedData.js`)

3. **Add npm script** in `package.json`:
   ```json
   "seed:users": "node data/seed/seedUsers.js"
   ```

---

## 🔄 Development vs Production

### Development (Local with Emulators)

```bash
npm run dev
  ↓
Auto-detects: NODE_ENV === 'development'
  ↓
Connects to: localhost:8080 (Firestore)
             localhost:5001 (Functions)
             localhost:9099 (Auth)
  ↓
Uses: Local emulators (safe, fast, free)
```

**Benefits:**
- ✅ Safe - can't break production
- ✅ Fast - no network latency
- ✅ Free - no cloud costs
- ✅ Offline - works without internet

### Production (Deployed)

```bash
npm run build && npm run start
  ↓
Auto-detects: NODE_ENV === 'production'
  ↓
Connects to: Real Firebase cloud
  ↓
Uses: Production Firebase (real data)
```

**No configuration needed** - it automatically uses production Firebase.

---

## 🎯 Best Practices

### ✅ DO (Recommended)

1. **Always use emulators for local development**
   - Safe - can't break production
   - Fast - no deployment wait
   - Free - no cloud costs

2. **Export data after seeding**
   - Saves time on next startup
   - Consistent data across sessions
   - Share with team

3. **Test functions locally before deploying**
   - Catch errors early
   - Faster iteration
   - Better debugging

4. **Keep seed data in version control**
   - JSON files in `/data/seed/` folder
   - Tracked in git
   - Team has same data

### ❌ DON'T

1. **Don't use production Firebase during development**
   - Risk of breaking production data
   - Costs money
   - Slow (network latency)

2. **Don't commit `data/emulator/` folder**
   - Too large
   - Changes frequently
   - Already in `.gitignore`

3. **Don't deploy untested functions**
   - Always test locally first
   - Use emulators to verify

---

## 🔍 How to Verify What You're Using

### Check Browser Console

**Using Emulators:**
```
🔧 Development mode detected - Connecting to Firebase Emulators
✅ Connected to Firebase Emulators successfully
```

**Using Production:**
```
(No emulator messages - using production Firebase)
```

### Check Network Tab

- **Emulators**: Requests to `localhost:8080`, `localhost:5001`
- **Production**: Requests to `firestore.googleapis.com`, `us-central1-*.cloudfunctions.net`

### Check Emulator UI

1. Open http://localhost:4000
2. Click "Firestore" tab
3. You should see your collections (e.g., `services`)
4. If you see data, you're using emulators ✅

---

## 🛠️ Troubleshooting

### Emulators Won't Start

**Issue**: Port already in use
```bash
# Check what's using the port
lsof -i :8080  # Firestore
lsof -i :5001  # Functions
lsof -i :9099  # Auth
lsof -i :4000  # UI

# Kill the process or use different ports in firebase.json
```

### Can't See Data in Emulator UI

**Issue**: Wrong project ID
```bash
# Make sure emulators start with project ID
npm run emulators  # Includes --project flag

# Verify data is there
# Open http://localhost:4000 → Firestore tab
# Check that project shows: bussiness-managment-syst-da008
```

### Seed Script Fails

**Issue**: Emulators not running
```bash
# Make sure emulators are running first
npm run emulators:start

# Then in another terminal:
npm run seed
```

### App Not Connecting to Emulators

**Issue**: App might be using production
```bash
# Check browser console for emulator connection messages
# Make sure you're running: npm run dev (not npm run start)
# Check that NODE_ENV is 'development'
```

---

## 📚 Additional Resources

- **Seed Data Guide**: `/docs/SEED_DATA_BEST_PRACTICES.md`
- **Emulator Setup**: `/docs/EMULATOR_SETUP.md`
- **Data Folder**: `/data/README.md`

---

## 🎓 Summary

### First Time Setup
1. `npm install` (root and functions)
2. `npm run emulators:start`
3. `npm run seed`
4. `npm run emulators:export`

### Daily Development
1. `npm run emulators` (Terminal 1)
2. `npm run dev` (Terminal 2)
3. Develop and test
4. View data at http://localhost:4000

### Key Points
- ✅ App **automatically** uses emulators in development
- ✅ No environment variables needed
- ✅ Seed data is in `/data/seed/` folder (version controlled)
- ✅ Exported data is in `/data/emulator/` (git-ignored)
- ✅ Production automatically uses real Firebase

**That's it!** 🎉
