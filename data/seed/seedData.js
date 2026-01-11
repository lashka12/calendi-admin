/**
 * Seed Data - Services and Admin User
 * 
 * This script sets up initial data for development:
 * - Imports services from services.json (in same folder) to Firestore
 * - Creates a default admin user (admin@test.com / admin123)
 * 
 * Works with both emulator (default) and production Firebase
 * 
 * Usage:
 *   node data/seed/seedData.js              # Seed to emulator (default)
 *   node data/seed/seedData.js --production  # Seed to production Firebase
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const admin = require('../../functions/node_modules/firebase-admin/lib/index.js');
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check if production mode
const isProduction = process.argv.includes('--production');

// Point to emulator if not production
if (!isProduction) {
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
  console.log('🔧 Using Firebase Emulator (localhost:8080)');
  // With singleProjectMode: true, emulator accepts any project ID
  // Use the same project ID as your app for consistency
  var projectId = 'bussiness-managment-syst-da008';
} else {
  console.log('☁️  Using Production Firebase');
  console.warn('⚠️  WARNING: You are importing to PRODUCTION!');
  var projectId = 'bussiness-managment-syst-da008';
}

// Initialize Firebase Admin (no credentials needed for emulator)
admin.initializeApp({ 
  projectId: projectId
});
const db = admin.firestore();

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
};

const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
};

/**
 * Create default admin user
 */
async function createAdminUser() {
  try {
    log.info('Creating admin user...');

    const adminEmail = 'admin@test.com';
    const adminPassword = 'admin123';

    // Check if user already exists
    try {
      const existingUser = await admin.auth().getUserByEmail(adminEmail);
      log.warning(`Admin user already exists: ${adminEmail}`);
      log.info(`   UID: ${existingUser.uid}`);
      return existingUser;
    } catch (error) {
      // User doesn't exist, create it
      if (error.code === 'auth/user-not-found') {
        const userRecord = await admin.auth().createUser({
          email: adminEmail,
          password: adminPassword,
          emailVerified: true,
          displayName: 'Test Admin',
        });

        log.success(`Admin user created successfully`);
        log.info(`   📧 Email: ${adminEmail}`);
        log.info(`   🔑 Password: ${adminPassword}`);
        log.info(`   🆔 UID: ${userRecord.uid}`);
        
        return userRecord;
      } else {
        throw error;
      }
    }
  } catch (error) {
    log.error(`Failed to create admin user: ${error.message}`);
    throw error;
  }
}

/**
 * Create personal settings (user profile info)
 */
async function seedPersonalSettings() {
  try {
    log.info('Setting up personal settings...');

    const settingsRef = db.collection('settings').doc('personal');
    const existingDoc = await settingsRef.get();

    const personalSettings = {
      firstName: 'Amal',
      lastName: 'Rizik',
      phone: '+972501234567',
      email: 'admin@test.com',
      theme: 'light',      // 'light' | 'dark' | 'system'
      language: 'en',      // 'en' | 'he' | 'ar'
      location: {
        address: '123 Main Street',
        city: 'Tel Aviv',
        country: 'Israel',
        postalCode: '6100000',
        coordinates: {      // For future map integration
          lat: 32.0853,
          lng: 34.7818,
        },
      },
    };

    if (existingDoc.exists) {
      await settingsRef.set(personalSettings, { merge: true });
      log.warning('Personal settings already exist, updated');
    } else {
      await settingsRef.set(personalSettings);
      log.success('Personal settings created');
    }

    log.info(`   👤 Name: ${personalSettings.firstName} ${personalSettings.lastName}`);
    log.info(`   📱 Phone: ${personalSettings.phone}`);
    log.info(`   📍 Location: ${personalSettings.location.city}, ${personalSettings.location.country}`);
    log.info(`   📧 Email: ${personalSettings.email}`);
    log.info(`   🎨 Theme: ${personalSettings.theme}`);
    log.info(`   🌐 Language: ${personalSettings.language}`);

    return personalSettings;
  } catch (error) {
    log.error(`Failed to create personal settings: ${error.message}`);
    throw error;
  }
}

/**
 * Create business settings (timezone, etc.)
 */
async function seedBusinessSettings() {
  try {
    log.info('Setting up business settings...');

    const settingsRef = db.collection('settings').doc('businessSettings');
    const existingDoc = await settingsRef.get();

    const businessSettings = {
      businessName: 'Amal Beauty Salon',
      establishedYear: 2020,         // Year the business was founded
      timezone: 'Asia/Jerusalem',    // IANA timezone string
      slotDuration: 15,              // Slot duration in minutes (15, 30, or 60)
      currency: 'ILS',               // Currency code (ILS, USD, EUR, etc.)
      description: 'Premium nail care and beauty services', // Short business description
    };

    if (existingDoc.exists) {
      // Update existing document (merge to preserve other fields)
      await settingsRef.set(businessSettings, { merge: true });
      log.warning('Business settings already exist, updated');
    } else {
      // Create new document
      await settingsRef.set(businessSettings);
      log.success('Business settings created');
    }

    log.info(`   🏪 Business: ${businessSettings.businessName}`);
    log.info(`   📅 Established: ${businessSettings.establishedYear}`);
    log.info(`   🌍 Timezone: ${businessSettings.timezone}`);
    log.info(`   ⏱️  Slot Duration: ${businessSettings.slotDuration} minutes`);

    return businessSettings;
  } catch (error) {
    log.error(`Failed to create business settings: ${error.message}`);
    throw error;
  }
}

/**
 * Import services from JSON file
 */
async function seedServices() {
  try {
    log.info('Reading services from services.json...');

    // Read JSON file
    const jsonPath = path.join(__dirname, 'services.json');
    
    if (!fs.existsSync(jsonPath)) {
      throw new Error(`Services file not found: ${jsonPath}`);
    }

    const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    
    if (!jsonData.services || !Array.isArray(jsonData.services)) {
      throw new Error('Invalid JSON format: expected { services: [...] }');
    }

    log.info(`Found ${jsonData.services.length} services to import\n`);

    // Check if emulator is running (for emulator mode)
    if (!isProduction) {
      try {
        await db.collection('_test').limit(1).get();
      } catch (error) {
        log.error('Emulator not running! Start it first with: npm run emulators');
        process.exit(1);
      }
    }

    const servicesRef = db.collection('services');
    let successCount = 0;
    let errorCount = 0;

    for (const service of jsonData.services) {
      try {
        // Validate service structure
        if (!service.names || !service.names.en) {
          throw new Error('Service missing required field: names.en');
        }

        // Add service to Firestore
        await servicesRef.add({
          names: {
            en: service.names.en,
            he: service.names.he || '',
            ar: service.names.ar || '',
          },
          descriptions: {
            en: service.descriptions?.en || '',
            he: service.descriptions?.he || '',
            ar: service.descriptions?.ar || '',
          },
          price: service.price || 0,
          duration: service.duration || 60,
          active: service.active !== false,
        });

        log.success(`Imported: ${service.names.en} (${service.duration} min, ₪${service.price})`);
        successCount++;
      } catch (error) {
        log.error(`Failed to import ${service.names?.en || 'Unknown'}: ${error.message}`);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    log.success(`Services import completed!`);
    console.log(`   ✅ Success: ${successCount}`);
    if (errorCount > 0) {
      log.error(`   ❌ Failed: ${errorCount}`);
    }
    console.log(`   📦 Total: ${jsonData.services.length}`);
    console.log('='.repeat(60) + '\n');

    if (!isProduction) {
      log.info('View your data at: http://localhost:4000');
    }

    return successCount;
  } catch (error) {
    log.error(`Import failed: ${error.message}`);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('\n🌱 Starting Data Seed Process...\n');

  try {
    // Create admin user first
    await createAdminUser();
    console.log('');

    // Set up personal settings (user profile)
    await seedPersonalSettings();
    console.log('');

    // Set up business settings (timezone, etc.)
    await seedBusinessSettings();
    console.log('');

    // Then seed services
    await seedServices();

    console.log('\n' + '='.repeat(60));
    log.success('🎉 Seed completed successfully!');
    console.log('='.repeat(60));
    console.log('\n📋 Login Credentials:');
    console.log(`   ${colors.green}Email:${colors.reset}    admin@test.com`);
    console.log(`   ${colors.green}Password:${colors.reset} admin123\n`);

    if (!isProduction) {
      log.info('View your data at: http://localhost:4000');
    }

    process.exit(0);
  } catch (error) {
    log.error(`Seed failed: ${error.message}`);
    process.exit(1);
  }
}

// Run seed
main();

