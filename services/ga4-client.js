// services/ga4-client.js - Google Analytics 4 client (FINAL VERSION)
const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const { GoogleAuth } = require('google-auth-library');

function initializeGA4Client() {
  console.log('🔧 Initializing GA4 Client...');
  
  try {
    // PRIORITAS 1: Gunakan GOOGLE_APPLICATION_CREDENTIALS_JSON (Railway recommended)
    let credentials = null;
    
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      console.log('   📦 Using GOOGLE_APPLICATION_CREDENTIALS_JSON from environment...');
      try {
        credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
        console.log(`   ✅ Credentials parsed successfully`);
      } catch (parseError) {
        console.error('   ❌ Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON:', parseError.message);
        console.error('   ℹ️  Make sure the JSON is valid and properly escaped in Railway Variables');
      }
    }
    // PRIORITAS 2: Fallback ke GOOGLE_APPLICATION_CREDENTIALS (jika ada)
    else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      console.log('   📦 Using GOOGLE_APPLICATION_CREDENTIALS from environment...');
      try {
        credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS);
        console.log(`   ✅ Credentials parsed successfully`);
      } catch (parseError) {
        console.error('   ❌ Failed to parse GOOGLE_APPLICATION_CREDENTIALS:', parseError.message);
      }
    }
    // PRIORITAS 3: Error jika tidak ada kredensial
    else {
      console.error('❌ No Google credentials found in environment variables.');
      console.error('   Please set GOOGLE_APPLICATION_CREDENTIALS_JSON in Railway Variables.');
      return null;
    }
    
    // Validasi credentials
    if (!credentials) {
      console.error('❌ No valid Google credentials found');
      return null;
    }
    
    if (!credentials.client_email) {
      console.error('❌ Invalid Google credentials: missing client_email');
      return null;
    }
    
    console.log(`   👤 Service Account: ${credentials.client_email}`);
    console.log(`   🔑 Credentials Type: ${credentials.type || 'unknown'}`);
    
    // Initialize Google Auth
    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
    });
    
    // Initialize Analytics Client
    const analyticsDataClient = new BetaAnalyticsDataClient({ auth });
    
    console.log('✅ GA4 Client object created successfully');
    return analyticsDataClient;
    
  } catch (error) {
    console.error('❌ Failed to initialize GA4 Client:', error.message);
    
    // Detailed error logging
    if (error.message.includes('Unexpected token')) {
      console.error('   ⚠️  This usually means the credentials contain invalid JSON');
      console.error('   ℹ️  Check Railway Variables - GOOGLE_APPLICATION_CREDENTIALS_JSON should be complete, valid JSON');
    }
    
    return null;
  }
}

// Fungsi test koneksi - dipanggil dari index.js nanti
async function testGA4Connection(client) {
  if (!client || !process.env.GA4_PROPERTY_ID) {
    console.log('   ⚠️  GA4 connection test skipped (missing client or property ID)');
    return false;
  }

  const propertyId = process.env.GA4_PROPERTY_ID.replace('properties/', ''); // Pastikan hanya angka
  console.log(`🧪 [DIAGNOSTICS] Starting GA4 connection test...`);
  console.log(`   Property ID: "${propertyId}"`);
  
  // Dapatkan email Service Account untuk referensi
  let serviceEmail = 'Unknown';
  try {
    // Coba dari berbagai sumber credentials
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      const creds = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
      serviceEmail = creds.client_email;
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      const creds = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS);
      serviceEmail = creds.client_email;
    }
    console.log(`   Service Account: ${serviceEmail}`);
  } catch (e) {
    console.log(`   ❌ Cannot parse service account credentials`);
  }

  try {
    console.log(`   Testing with simple query...`);
    
    // Query yang sangat sederhana dengan error handling yang lebih baik
    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: '2024-01-01', endDate: 'today' }],
      metrics: [{ name: 'activeUsers' }],
      limit: 1
    });
    
    console.log(`   ✅ [DIAGNOSTICS] SUCCESS! GA4 connection is VALID.`);
    console.log(`      Server accepted Property ID: ${propertyId}`);
    
    if (response && response.rows && response.rows.length > 0) {
      const activeUsers = response.rows[0].metricValues[0]?.value || '0';
      console.log(`      Active Users (sample): ${activeUsers}`);
    }
    
    return true;
    
  } catch (error) {
    console.error(`   ❌ [DIAGNOSTICS] GA4 connection test FAILED:`);
    console.error(`      Error: "${error.message}"`);
    
    // Cek error spesifik
    if (error.message.includes('PERMISSION_DENIED')) {
      console.error(`      ⚠️  PERMISSION_DENIED: Service Account doesn't have access`);
      console.error(`         Add ${serviceEmail} to GA4 Property with "Viewer" role`);
    } else if (error.message.includes('NOT_FOUND')) {
      console.error(`      ⚠️  NOT_FOUND: Property ID ${propertyId} doesn't exist`);
      console.error(`         Verify the Property ID in Google Analytics`);
    } else if (error.message.includes('invalid_credentials')) {
      console.error(`      ⚠️  INVALID_CREDENTIALS: Check service account JSON`);
    }
    
    // Log error details
    if (error.details) {
      console.error(`      Details:`, JSON.stringify(error.details, null, 2));
    }
    
    return false;
  }
}

// Export fungsi yang diperlukan
module.exports = { 
  initializeGA4Client, 
  testGA4Connection 
};
