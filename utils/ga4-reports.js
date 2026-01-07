// utils/ga4-reports.js - SIMPLE VERSION
// Fokus pada Active Users & Views hari ini saja

const { BetaAnalyticsDataClient } = require('@google-analytics/data');

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Helper untuk escape HTML
 */
function escapeHtml(text) {
  if (!text) return '';
  return text.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Helper untuk mendapatkan tanggal hari ini dalam format YYYY-MM-DD
 */
function getTodayDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Helper untuk mendapatkan waktu sekarang WIB
 */
function getCurrentTimeWIB() {
  return new Date().toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).replace(/\./g, ':');
}

/**
 * Helper untuk format tanggal Indonesia lengkap
 */
function getTanggalIndo() {
  return new Date().toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

// ============================================
// MAIN GA4 DATA FETCHING FUNCTION (SIMPLE)
// ============================================

/**
 * Fetch GA4 data - HANYA Active Users & Views untuk hari ini
 */
async function fetchUserArticleData(analyticsDataClient, userData) {
  try {
    // Ambil pagePath dari data user
    const pagePath = userData.ga4Path || userData.destinationUrl?.match(/https?:\/\/[^\/]+(\/.*)/)?.[1] || '/';
    const userName = userData.nama || userData.name || 'User';

    console.log(`🔍 [GA4 Query SIMPLE] untuk: ${userName}`);
    console.log(`   Path: ${pagePath}`);

    if (!pagePath || pagePath === '/') {
      throw new Error('Page path tidak valid');
    }

    // QUERY SEDERHANA: Hanya ambil activeUsers & screenPageViews untuk hari ini
    const [response] = await analyticsDataClient.runReport({
      property: `properties/${process.env.GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate: 'today', endDate: 'today' }],
      dimensions: [{ name: 'pagePath' }],
      metrics: [
        { name: 'activeUsers' },
        { name: 'screenPageViews' }
      ],
      dimensionFilter: {
        filter: {
          fieldName: 'pagePath',
          stringFilter: {
            matchType: 'EXACT',
            value: pagePath,
            caseSensitive: false
          }
        }
      },
      limit: 1
    });

    // PROSES HASIL
    if (response && response.rows && response.rows.length > 0) {
      const row = response.rows[0];
      const activeUsers = parseInt(row.metricValues[0]?.value) || 0;
      const pageViews = parseInt(row.metricValues[1]?.value) || 0;
      
      console.log(`   ✅ Hasil: ${activeUsers} users, ${pageViews} views`);
      
      return {
        activeUsers: activeUsers,
        pageViews: pageViews,
        dataDate: getTodayDate(),
        note: 'Data hari ini (00:00 WIB - sekarang)',
        success: true
      };
      
    } else {
      console.log(`   ⚠️  Tidak ada data hari ini`);
      
      return {
        activeUsers: 0,
        pageViews: 0,
        dataDate: getTodayDate(),
        note: 'Belum ada traffic hari ini',
        success: true
      };
    }

  } catch (error) {
    console.error('❌ Error fetchUserArticleData:', error.message);
    
    return {
      activeUsers: 0,
      pageViews: 0,
      dataDate: getTodayDate(),
      error: error.message,
      success: false
    };
  }
}

// ============================================
// REPORT FORMATTING FUNCTION (SIMPLE)
// ============================================

/**
 * Format laporan - HANYA Active Users & Views
 */
function formatCustomReport(userData, articleData) {
  const waktuSekarang = getCurrentTimeWIB();
  const userName = escapeHtml(userData.nama || userData.name || 'User');
  const userId = userData.id || 'N/A';
  
  // Shortlink display
  const shortlink = userData.shortlink || '';
  let linkDisplay = 'Tidak ada';
  if (shortlink) {
    linkDisplay = shortlink.replace(/^https?:\/\//, '');
  }
  
  // Artikel title
  let articleTitle = userData.articleTitle || 'N/A';
  if (articleTitle.length > 35) {
    articleTitle = articleTitle.substring(0, 32) + '...';
  }

  // FORMAT LAPORAN SIMPLE
  let reportMessage = `📈 <b>LAPORAN ${waktuSekarang}</b>\n\n`;
  reportMessage += `👤 <b>Nama:</b> ${userName}\n`;
  reportMessage += `👤 <b>ID:</b> ${userId}\n`;
  reportMessage += `🔗 <b>Link:</b> <code>https://${linkDisplay}</code>\n`;
  reportMessage += `📄 <b>Artikel:</b> ${escapeHtml(articleTitle)}\n\n`;
  
  reportMessage += `📊 <b>PERFORMANCE HARI INI</b>\n`;
  reportMessage += `👥 <b>Active User:</b> <b>${articleData.activeUsers || 0}</b>\n`;
  reportMessage += `👁️ <b>Views:</b> <b>${articleData.pageViews || 0}</b>\n\n`;
  
  // Tambahkan note error jika ada
  if (articleData.error) {
    reportMessage += `⚠️ <b>CATATAN:</b> <code>${escapeHtml(articleData.error)}</code>\n\n`;
  }
  
  reportMessage += `ℹ️ <i>Data dihitung sejak 00:00 WIB hingga saat ini.</i>\n\n`;
  reportMessage += `🕐 <i>Laporan dibuat: ${waktuSekarang} WIB</i>`;

  return reportMessage;
}

// ============================================
// DEBUG FUNCTIONS (OPTIONAL)
// ============================================

/**
 * Debug function untuk test GA4 connection
 */
async function debugGA4Connection(analyticsDataClient) {
  try {
    const [response] = await analyticsDataClient.runReport({
      property: `properties/${process.env.GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate: 'yesterday', endDate: 'today' }],
      dimensions: [{ name: 'date' }],
      metrics: [
        { name: 'activeUsers' },
        { name: 'screenPageViews' }
      ],
      limit: 2
    });

    return {
      success: true,
      propertyId: process.env.GA4_PROPERTY_ID,
      data: response.rows || []
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      propertyId: process.env.GA4_PROPERTY_ID
    };
  }
}

// ============================================
// EXPORT FUNCTIONS
// ============================================

module.exports = {
  // Main functions
  fetchUserArticleData,
  formatCustomReport,
  
  // Debug functions
  debugGA4Connection,
  
  // Helper functions
  escapeHtml,
  getTodayDate,
  getCurrentTimeWIB,
  getTanggalIndo
};
