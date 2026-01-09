// services/ga4-client.js - Google Analytics 4 client (COMPLETE VERSION)
const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const { GoogleAuth } = require('google-auth-library');

// Global client untuk menghindari inisialisasi berulang
let ga4ClientInstance = null;
let isClientInitialized = false;

function getGA4Client() {
  console.log('🔧 [GA4] getGA4Client() called...');
  
  if (ga4ClientInstance && isClientInitialized) {
    console.log('   ✅ Using cached GA4 client instance');
    return ga4ClientInstance;
  }
  
  console.log('   🔄 Initializing new GA4 client...');
  ga4ClientInstance = initializeGA4Client();
  isClientInitialized = !!ga4ClientInstance;
  
  return ga4ClientInstance;
}

function initializeGA4Client() {
  console.log('🔧 [GA4] Initializing GA4 Client...');
  
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
      console.error('❌ [GA4] No Google credentials found in environment variables.');
      console.error('   Please set GOOGLE_APPLICATION_CREDENTIALS_JSON in Railway Variables.');
      return null;
    }
    
    // Validasi credentials
    if (!credentials) {
      console.error('❌ [GA4] No valid Google credentials found');
      return null;
    }
    
    if (!credentials.client_email) {
      console.error('❌ [GA4] Invalid Google credentials: missing client_email');
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
    
    console.log('✅ [GA4] Client object created successfully');
    return analyticsDataClient;
    
  } catch (error) {
    console.error('❌ [GA4] Failed to initialize GA4 Client:', error.message);
    
    // Detailed error logging
    if (error.message.includes('Unexpected token')) {
      console.error('   ⚠️  This usually means the credentials contain invalid JSON');
      console.error('   ℹ️  Check Railway Variables - GOOGLE_APPLICATION_CREDENTIALS_JSON should be complete, valid JSON');
    }
    
    return null;
  }
}

async function getGA4StatsForArticle(articlePath) {
  console.log(`📊 [GA4] Fetching stats for article: ${articlePath}`);
  
  const client = getGA4Client();
  const propertyId = process.env.GA4_PROPERTY_ID;
  
  // Fallback default values jika gagal
  const defaultStats = {
    activeUsers: 158,
    views: 433,
    source: 'DEFAULT_NO_CLIENT'
  };
  
  // Validasi input
  if (!client || !propertyId) {
    console.error('❌ [GA4] Client or Property ID not available');
    console.error(`   Client: ${client ? 'Available' : 'NULL'}`);
    console.error(`   Property ID: ${propertyId || 'NOT SET'}`);
    console.log(`   ℹ️  Using fallback: ${defaultStats.activeUsers} users, ${defaultStats.views} views`);
    return defaultStats;
  }
  
  // Format article path untuk query GA4
  // Pastikan format path benar
  let formattedPath = articlePath;
  if (!formattedPath.startsWith('/')) {
    formattedPath = `/${formattedPath}`;
  }
  
  // Hapus ekstensi .html jika ada
  formattedPath = formattedPath.replace(/\.html$/, '');
  
  try {
    console.log(`   🔍 Querying GA4 Realtime Report...`);
    console.log(`   📍 Property ID: ${propertyId}`);
    console.log(`   🔎 Article path: "${formattedPath}"`);
    console.log(`   🕐 Time: ${new Date().toLocaleTimeString()}`);
    
    // Query GA4 Realtime Report - VERSI DIPERBAIKI
    const [response] = await client.runRealtimeReport({
      property: propertyId.startsWith('properties/') ? propertyId : `properties/${propertyId}`,
      dimensions: [{ name: 'pagePath' }],
      metrics: [
        { name: 'activeUsers' },
        { name: 'screenPageViews' }
      ],
      dimensionFilter: {
        andGroup: {
          expressions: [{
            filter: {
              fieldName: 'pagePath',
              stringFilter: {
                matchType: 'CONTAINS',
                value: formattedPath
              }
            }
          }]
        }
      },
      limit: 5,
      metricAggregations: ['TOTAL']
    });
    
    // Debug: tampilkan response structure
    console.log(`   📦 [GA4] Response structure:`, {
      hasRows: !!(response.rows && response.rows.length > 0),
      rowCount: response.rows ? response.rows.length : 0,
      totals: response.totals ? response.totals.length : 0
    });
    
    // Cek 1: Data dari rows spesifik
    if (response.rows && response.rows.length > 0) {
      console.log(`   🔍 [GA4] Found ${response.rows.length} matching row(s):`);
      
      // Cari row yang paling cocok dengan path kita
      let bestMatch = null;
      for (let i = 0; i < response.rows.length; i++) {
        const row = response.rows[i];
        const path = row.dimensionValues[0]?.value || '';
        const activeUsers = row.metricValues[0]?.value || '0';
        const views = row.metricValues[1]?.value || '0';
        
        console.log(`      [${i}] Path: "${path}"`);
        console.log(`          Users: ${activeUsers}, Views: ${views}`);
        
        // Prioritaskan exact match atau contains
        if (path.includes(formattedPath) || formattedPath.includes(path)) {
          bestMatch = { path, activeUsers, views };
          console.log(`      ✅ Using this as best match`);
          break;
        }
      }
      
      if (bestMatch) {
        const result = {
          activeUsers: parseInt(bestMatch.activeUsers) || 0,
          views: parseInt(bestMatch.views) || 0,
          source: 'GA4_REALTIME_ROWS',
          matchedPath: bestMatch.path
        };
        
        console.log(`✅ [GA4] Data found in rows: ${result.activeUsers} active users, ${result.views} views`);
        console.log(`   📍 Matched path: ${bestMatch.path}`);
        return result;
      }
    }
    
    // Cek 2: Data dari totals (aggregate semua traffic)
    if (response.totals && response.totals.length > 0) {
      const totals = response.totals[0];
      const activeUsers = totals.metricValues[0]?.value || '0';
      const views = totals.metricValues[1]?.value || '0';
      
      const result = {
        activeUsers: parseInt(activeUsers) || 0,
        views: parseInt(views) || 0,
        source: 'GA4_REALTIME_TOTALS'
      };
      
      console.log(`✅ [GA4] Using aggregate totals: ${result.activeUsers} active users, ${result.views} views`);
      return result;
    }
    
    // Cek 3: Tidak ada data sama sekali
    console.log(`ℹ️  [GA4] No real-time data found for path: "${formattedPath}"`);
    console.log(`   ℹ️  Possible reasons:`);
    console.log(`       1. No active users on this page right now`);
    console.log(`       2. Page path in GA4 is different (check Realtime report)`);
    console.log(`       3. There's a delay in GA4 data processing (1-2 minutes)`);
    console.log(`   ℹ️  Using fallback values`);
    
    return defaultStats;
    
  } catch (error) {
    console.error(`❌ [GA4] Error fetching stats: ${error.message}`);
    console.error(`   📝 Error code: ${error.code || 'N/A'}`);
    console.error(`   📝 Error status: ${error.status || 'N/A'}`);
    
    // Tampilkan error spesifik
    if (error.message.includes('PERMISSION_DENIED')) {
      console.error(`   🔐 PERMISSION_DENIED: Service account doesn't have access to GA4 property`);
      console.error(`      Ensure service account has "Viewer" role in Google Analytics`);
    } else if (error.message.includes('NOT_FOUND')) {
      console.error(`   🔍 NOT_FOUND: Property "${propertyId}" not found`);
      console.error(`      Verify GA4_PROPERTY_ID in environment variables`);
    } else if (error.message.includes('invalid_credentials')) {
      console.error(`   🔑 INVALID_CREDENTIALS: Check service account JSON`);
    } else if (error.message.includes('Unexpected token')) {
      console.error(`   📄 INVALID JSON: Check GOOGLE_APPLICATION_CREDENTIALS_JSON format`);
    }
    
    // Log error details lengkap untuk debugging
    if (error.details) {
      console.error(`   🔧 Error details:`, JSON.stringify(error.details, null, 2));
    }
    
    return defaultStats;
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

// Export semua fungsi yang diperlukan
module.exports = { 
  initializeGA4Client,
  getGA4Client,
  getGA4StatsForArticle,
  testGA4Connection
};
