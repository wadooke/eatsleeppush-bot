// utils/ga4-reports.js - FIXED VERSION (NO <small> TAG)
const { BetaAnalyticsDataClient } = require('@google-analytics/data');

// Helper function untuk escape HTML
function escapeHtml(text) {
  if (!text) return '';
  return text.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Helper untuk mendapatkan tanggal hari ini dalam format YYYY-MM-DD
function getTodayDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper untuk mendapatkan waktu sekarang WIB
function getCurrentTimeWIB() {
  return new Date().toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).replace(/\./g, ':');
}

// Helper untuk format tanggal Indonesia lengkap
function getTanggalIndo() {
  return new Date().toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

/**
 * Format link untuk tampil sebagai teks (bukan hyperlink)
 */
function formatLinkAsText(url) {
  try {
    if (!url) return '<code>Tidak ada</code>';
    
    // Hapus https:// atau http:// untuk display
    let displayText = url;
    if (displayText.startsWith('https://')) {
      displayText = displayText.substring(8);
    } else if (displayText.startsWith('http://')) {
      displayText = displayText.substring(7);
    }
    
    return `<code>https://${displayText}</code>`;
    
  } catch {
    return `<code>${escapeHtml(url || 'Tidak ada')}</code>`;
  }
}

/**
 * Fetch GA4 data untuk hari ini saja (00:00 - 23:59 WIB)
 */
async function fetchUserArticleData(analyticsDataClient, userData) {
  try {
    const pagePath = userData.ga4Path || userData.destinationUrl?.match(/https?:\/\/[^\/]+(\/.*)/)?.[1] || '/';
    const userName = userData.nama || userData.name || 'User';
    
    console.log(`🔍 [GA4 Query HARIAN] untuk: ${userName}`);
    console.log(`   Path: ${pagePath}`);

    if (!pagePath || pagePath === '/') {
      throw new Error('Page path tidak valid');
    }

    // QUERY UNTUK HARI INI SAJA
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

    // PROSES DATA HARIAN
    if (response && response.rows && response.rows.length > 0) {
      const row = response.rows[0];
      const activeUsers = parseInt(row.metricValues[0]?.value) || 0;
      const pageViews = parseInt(row.metricValues[1]?.value) || 0;
      
      console.log(`   📈 Hasil: ${activeUsers} active users, ${pageViews} page views`);
      
      return {
        activeUsers: activeUsers,
        pageViews: pageViews,
        dataDate: getTodayDate(),
        isTodayData: true
      };
      
    } else {
      console.log(`   ⚠️  Tidak ada data untuk hari ini`);
      
      return {
        activeUsers: 0,
        pageViews: 0,
        dataDate: getTodayDate(),
        isTodayData: true,
        note: 'Belum ada traffic hari ini'
      };
    }

  } catch (error) {
    console.error('❌ Error fetchUserArticleData:', error.message);
    
    if (error.details) {
      console.error('   Details:', error.details);
    }
    
    return {
      activeUsers: 0,
      pageViews: 0,
      dataDate: getTodayDate(),
      error: error.message,
      isTodayData: true
    };
  }
}

/**
 * Format laporan - FIXED (NO <small> TAG)
 */
function formatCustomReport(userData, articleData) {
  const waktuSekarang = getCurrentTimeWIB();
  const userName = escapeHtml(userData.nama || userData.name || 'User');
  const userId = userData.id || 'N/A';
  const tanggalIndo = getTanggalIndo();
  
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

  // FORMAT BARU - NO <small> TAG
  return `📈 <b>LAPORAN ${waktuSekarang}</b>

👤 <b>Nama:</b> ${userName}
👤 <b>ID:</b> ${userId}
🔗 <b>Link:</b> <code>https://${linkDisplay}</code>
📄 <b>Artikel:</b> ${escapeHtml(articleTitle)}
👥 <b>Active User:</b> ${articleData.activeUsers || 0}
👁️ <b>Views:</b> ${articleData.pageViews || 0}

<i>🕐 ${tanggalIndo} | Reset: 00:00 WIB</i>`;
}

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
        { name: 'screenPageViews' },
        { name: 'sessions' }
      ],
      limit: 1
    });

    return {
      success: true,
      propertyId: process.env.GA4_PROPERTY_ID,
      data: response.rows || [],
      totalMetrics: response.rows ? response.rows[0]?.metricValues : null
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      propertyId: process.env.GA4_PROPERTY_ID
    };
  }
}

// EXPORT FUNCTIONS
module.exports = {
  fetchUserArticleData,
  formatCustomReport,
  debugGA4Connection,
  escapeHtml,
  formatLinkAsText,
  getTodayDate,
  getCurrentTimeWIB,
  getTanggalIndo
};
