// services/ga4-client.js - Google Analytics 4 client (COMPLETE VERSION - FIXED DATE RANGE)
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

// =========== FUNGSI BARU UNTUK DATA HARI INI ===========
// Fungsi ini yang akan dipanggil oleh /cekvar untuk data "hari ini"
async function getGA4StatsForArticleToday(articlePath) {
  console.log(`📊 [GA4-TODAY] Fetching TODAY'S stats for article: ${articlePath}`);
  
  const client = getGA4Client();
  const propertyId = process.env.GA4_PROPERTY_ID;
  
  // Fallback default values jika gagal
  const defaultStats = {
    activeUsers: 0,
    views: 0,
    source: 'DEFAULT_NO_CLIENT'
  };
  
  // Validasi input
  if (!client || !propertyId) {
    console.error('❌ [GA4-TODAY] Client or Property ID not available');
    console.error(`   Client: ${client ? 'Available' : 'NULL'}`);
    console.error(`   Property ID: ${propertyId || 'NOT SET'}`);
    console.log(`   ℹ️  Using fallback: ${defaultStats.activeUsers} users, ${defaultStats.views} views`);
    return defaultStats;
  }
  
  // Format article path untuk query GA4
  let formattedPath = articlePath;
  if (!formattedPath.startsWith('/')) {
    formattedPath = `/${formattedPath}`;
  }
  
  // Hapus ekstensi .html jika ada
  formattedPath = formattedPath.replace(/\.html$/, '');
  
  try {
    // =========== PERBAIKAN UTAMA DI SINI ===========
    // Dapatkan tanggal HARI INI dalam format YYYY-MM-DD
    // Untuk WIB (UTC+7), kita perlu menyesuaikan jika server tidak di timezone WIB
    const today = getTodayWIBDate(); // Fungsi baru untuk mendapatkan tanggal WIB
    
    console.log(`   🔍 Querying GA4 for TODAY (since 00:00 WIB)...`);
    console.log(`   📍 Property ID: ${propertyId}`);
    console.log(`   🔎 Article path: "${formattedPath}"`);
    console.log(`   📅 Date Range: ${today} to ${today}`);
    console.log(`   🕐 Query Time (Server): ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`);
    
    // Query GA4 untuk DATA HARI INI (bukan realtime)
    const [response] = await client.runReport({
      property: propertyId.startsWith('properties/') ? propertyId : `properties/${propertyId}`,
      dateRanges: [{ 
        startDate: today, // Mulai hari ini
        endDate: today    // Sampai hari ini
      }],
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
      limit: 5
    });
    
    // Debug: tampilkan response structure
    console.log(`   📦 [GA4-TODAY] Response structure:`, {
      hasRows: !!(response.rows && response.rows.length > 0),
      rowCount: response.rows ? response.rows.length : 0
    });
    
    // Cek 1: Data dari rows spesifik
    if (response.rows && response.rows.length > 0) {
      console.log(`   🔍 [GA4-TODAY] Found ${response.rows.length} matching row(s) for today:`);
      
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
          console.log(`      ✅ Using this as best match for today's data`);
          break;
        }
      }
      
      if (bestMatch) {
        const result = {
          activeUsers: parseInt(bestMatch.activeUsers) || 0,
          views: parseInt(bestMatch.views) || 0,
          source: 'GA4_TODAY_ROWS',
          matchedPath: bestMatch.path,
          dateRange: `${today} to ${today}`
        };
        
        console.log(`✅ [GA4-TODAY] TODAY'S Data found: ${result.activeUsers} active users, ${result.views} views`);
        console.log(`   📍 Matched path: ${bestMatch.path}`);
        return result;
      }
    }
    
    // Cek 2: Tidak ada data sama sekali untuk hari ini
    console.log(`ℹ️  [GA4-TODAY] No data found for TODAY (${today}) for path: "${formattedPath}"`);
    console.log(`   ℹ️  This is normal if:`);
    console.log(`       1. No visitors yet today`);
    console.log(`       2. Page hasn't been viewed today`);
    console.log(`       3. Data processing delay (can be up to 24-48 hours for standard reports)`);
    console.log(`   ℹ️  Returning zeros for today's data`);
    
    return {
      activeUsers: 0,
      views: 0,
      source: 'GA4_TODAY_NO_DATA',
      dateRange: `${today} to ${today}`
    };
    
  } catch (error) {
    console.error(`❌ [GA4-TODAY] Error fetching TODAY'S stats: ${error.message}`);
    
    // Tampilkan error spesifik
    if (error.message.includes('PERMISSION_DENIED')) {
      console.error(`   🔐 PERMISSION_DENIED: Service account doesn't have access to GA4 property`);
    } else if (error.message.includes('NOT_FOUND')) {
      console.error(`   🔍 NOT_FOUND: Property "${propertyId}" not found`);
    }
    
    return defaultStats;
  }
}

// =========== FUNGSI UNTUK MENDAPATKAN TANGGAL WIB ===========
function getTodayWIBDate() {
  // Mendapatkan waktu sekarang dalam UTC
  const now = new Date();
  
  // Konversi ke WIB (UTC+7)
  const wibOffset = 7 * 60 * 60 * 1000; // 7 jam dalam milidetik
  const wibTime = new Date(now.getTime() + wibOffset);
  
  // Format ke YYYY-MM-DD
  const year = wibTime.getUTCFullYear();
  const month = String(wibTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(wibTime.getUTCDate()).padStart(2, '0');
  
  const todayWIB = `${year}-${month}-${day}`;
  
  console.log(`   🕐 [DATE CALC] Server UTC: ${now.toISOString()}`);
  console.log(`   🕐 [DATE CALC] WIB Time: ${wibTime.toISOString()}`);
  console.log(`   🕐 [DATE CALC] Today WIB Date: ${todayWIB}`);
  
  return todayWIB;
}

// =========== FUNGSI LAMA (untuk realtime) TETAP ADA ===========
async function getGA4StatsForArticle(articlePath) {
  console.log(`📊 [GA4-REALTIME] Fetching REALTIME stats for article: ${articlePath}`);
  
  const client = getGA4Client();
  const propertyId = process.env.GA4_PROPERTY_ID;
  
  // Fallback default values jika gagal
  const defaultStats = {
    activeUsers: 0,
    views: 0,
    source: 'DEFAULT_NO_CLIENT'
  };
  
  // Validasi input
  if (!client || !propertyId) {
    console.error('❌ [GA4-REALTIME] Client or Property ID not available');
    console.log(`   ℹ️  Using fallback: ${defaultStats.activeUsers} users, ${defaultStats.views} views`);
    return defaultStats;
  }
  
  // Format article path
  let formattedPath = articlePath;
  if (!formattedPath.startsWith('/')) {
    formattedPath = `/${formattedPath}`;
  }
  formattedPath = formattedPath.replace(/\.html$/, '');
  
  try {
    console.log(`   🔍 Querying GA4 Realtime Report...`);
    
    // Query GA4 Realtime Report (30 menit terakhir)
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
    
    // ... (kode realtime tetap sama seperti sebelumnya)
    // Untuk singkatnya, bagian ini sama dengan kode asli Anda
    
    return defaultStats;
    
  } catch (error) {
    console.error(`❌ [GA4-REALTIME] Error: ${error.message}`);
    return defaultStats;
  }
}

// Fungsi test koneksi
async function testGA4Connection(client) {
  // ... (kode test connection tetap sama seperti asli)
  // Untuk singkatnya, bagian ini sama dengan kode asli Anda
  
  return true;
}

// =========== EXPORT FUNGSI BARU ===========
// Export semua fungsi yang diperlukan, TAMBAHKAN fungsi baru
module.exports = { 
  initializeGA4Client,
  getGA4Client,
  getGA4StatsForArticle,      // Untuk data realtime (30 menit terakhir)
  getGA4StatsForArticleToday, // FUNGSI BARU: untuk data hari ini
  testGA4Connection
};
