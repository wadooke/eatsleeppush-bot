// services/ga4-client.js - Google Analytics 4 client
const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const { GoogleAuth } = require('google-auth-library');

function initializeGA4Client() {
  console.log('🔧 Initializing GA4 Client...');
  
  try {
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      console.error('❌ GOOGLE_APPLICATION_CREDENTIALS not found in environment');
      return null;
    }
    
    const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS);
    
    if (!credentials.client_email) {
      console.error('❌ Invalid Google credentials: missing client_email');
      return null;
    }
    
    console.log(`   Service Account: ${credentials.client_email}`);
    
    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
    });
    
    const analyticsDataClient = new BetaAnalyticsDataClient({ auth });
    
    // Test the connection
    testGA4Connection(analyticsDataClient);
    
    console.log('✅ GA4 Client initialized successfully');
    return analyticsDataClient;
    
  } catch (error) {
    console.error('❌ Failed to initialize GA4 Client:', error.message);
    
    // Detailed error logging
    if (error.message.includes('Unexpected token')) {
      console.error('   This usually means GOOGLE_APPLICATION_CREDENTIALS contains invalid JSON');
      console.error('   Check the value in Railway Variables - it should be complete JSON, not a filename');
    }
    
    return null;
  }
}

async function testGA4Connection(client) {
  if (!client || !process.env.GA4_PROPERTY_ID) {
    console.log('   ⚠️  GA4 connection test skipped (missing client or property ID)');
    return;
  }

  const propertyId = process.env.GA4_PROPERTY_ID.replace('properties/', ''); // Pastikan hanya angka
  console.log(`🧪 [DIAGNOSTICS] Starting GA4 connection test...`);
  console.log(`   Property ID: "${propertyId}"`);
  
  // Dapatkan email Service Account untuk referensi
  let serviceEmail = 'Unknown';
  try {
    const creds = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS);
    serviceEmail = creds.client_email;
    console.log(`   Service Account: ${serviceEmail}`);
  } catch (e) {
    console.log(`   ❌ Cannot parse service account credentials`);
  }

  try {
    console.log(`   Testing with simple query...`);
    // Query yang sangat sederhana
    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: '2020-01-01', endDate: 'today' }], // Rentang tanggal lebar
      metrics: [{ name: 'sessions' }],
      limit: 1
    });
    
    console.log(`   ✅ [DIAGNOSTICS] SUCCESS! GA4 connection is VALID.`);
    console.log(`      Server accepted Property ID: ${propertyId}`);
    
  } catch (error) {
    console.error(`   ❌ [DIAGNOSTICS] GA4 connection test FAILED:`);
    console.error(`      Main Message: "${error.message}"`);
    
    // ===== BAGIAN PENTING: Mencoba segala cara untuk mendapatkan detail error =====
    console.error(`      --- Full Error Object Inspection ---`);
    
    // Cara 1: Error details langsung dari Google API
    if (error.details) {
      console.error(`      [VIA error.details]:`, JSON.stringify(error.details, null, 2));
    }
    
    // Cara 2: Metadata gRPC
    if (error.metadata) {
      console.error(`      [VIA error.metadata]:`, JSON.stringify(error.metadata.getMap(), null, 2));
    }
    
    // Cara 3: Inspect semua properti pada objek error
    console.error(`      [All Error Properties]:`);
    for (let key in error) {
      if (error[key] !== undefined && typeof error[key] !== 'function') {
        try {
          console.error(`        ${key}: ${JSON.stringify(error[key])}`);
        } catch (e) {
          console.error(`        ${key}: [Cannot stringify]`);
        }
      }
    }
    // ===== AKHIR BAGIAN DIAGNOSIS =====
    
    console.error(`      --- Recommended Action ---`);
    console.error(`      1. DOUBLE-CHECK Property ID in Railway Variables.`);
    console.error(`         Current value: "${process.env.GA4_PROPERTY_ID}"`);
    console.error(`         It should be NUMERIC ONLY, e.g., "507582936".`);
    console.error(`      2. VERIFY Service Account access in Google Analytics:`);
    console.error(`         Go to GA4 Admin > Property Access Management`);
    console.error(`         Add this email: ${serviceEmail} with "Viewer" role.`);
    console.error(`      3. Ensure the GA4 property exists and is active.`);
  }
}
