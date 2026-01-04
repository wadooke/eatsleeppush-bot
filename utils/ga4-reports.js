// utils/ga4-reports.js - COMPLETE VERSION
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

// Helper function untuk extract path dari URL
function extractPathFromUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.pathname || '/';
  } catch {
    return '/';
  }
}

// Helper function untuk extract title dari URL
function extractTitleFromUrl(url) {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(p => p);
    const lastPart = pathParts[pathParts.length - 1] || 'unknown-article';
    
    // Convert kebab-case to readable title (optional)
    return lastPart
      .replace(/-/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase());
  } catch {
    return 'unknown-article';
  }
}

/**
 * Fetch GA4 data for specific user article
 * @param {object} analyticsDataClient - GA4 client instance
 * @param {object} userData - User data from database
 * @returns {object} Article metrics
 */
async function fetchUserArticleData(analyticsDataClient, userData) {
  try {
    // COMPATIBILITY: userData bisa dari format lama atau baru
    const pagePath = userData.ga4Path || extractPathFromUrl(userData.destinationUrl || userData.articleUrl || '');
    const userName = userData.nama || userData.name || 'User';
    
    console.log(`🔍 [GA4 Query] untuk: ${userName}`);
    console.log(`   Path: ${pagePath}`);
    console.log(`   Property ID: ${process.env.GA4_PROPERTY_ID}`);
    
    if (!pagePath || pagePath === '/') {
      throw new Error('Page path tidak valid untuk query GA4');
    }

    // Encode path untuk GA4 query
    const encodedPath = encodeURI(pagePath);
    
    // BUAT QUERY GA4
    const [response] = await analyticsDataClient.runReport({
      property: `properties/${process.env.GA4_PROPERTY_ID}`,
      dateRanges: [{
        startDate: '30daysAgo', // Last 30 days
        endDate: 'today',
      }],
      dimensions: [
        { name: 'pagePath' },
        { name: 'pageTitle' }
      ],
      metrics: [
        { name: 'activeUsers' },
        { name: 'screenPageViews' }
      ],
      dimensionFilter: {
        andGroup: {
          expressions: [
            {
              filter: {
                fieldName: 'pagePath',
                stringFilter: {
                  matchType: 'EXACT',
                  value: pagePath,
                  caseSensitive: false
                }
              }
            }
          ]
        }
      },
      orderBys: [
        { metric: { metricName: 'screenPageViews' }, desc: true }
      ],
      limit: 10
    });

    // PROSES RESPONSE
    if (!response || !response.rows || response.rows.length === 0) {
      console.log(`⚠️  Tidak ada data GA4 untuk path: ${pagePath}`);
      return {
        activeUsers: 0,
        pageViews: 0,
        lastUpdated: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
      };
    }

    // Hitung total dari semua rows
    let totalActiveUsers = 0;
    let totalPageViews = 0;
    
    response.rows.forEach(row => {
      totalActiveUsers += parseInt(row.metricValues[0].value) || 0;
      totalPageViews += parseInt(row.metricValues[1].value) || 0;
    });

    console.log(`   📊 Hasil: ${totalActiveUsers} active users, ${totalPageViews} page views`);

    return {
      activeUsers: totalActiveUsers,
      pageViews: totalPageViews,
      lastUpdated: new Date().toLocaleString('id-ID', { 
        timeZone: 'Asia/Jakarta',
        hour12: false 
      }),
      rawData: response.rows // Untuk debugging
    };

  } catch (error) {
    console.error('❌ Error fetchUserArticleData:', error.message);
    
    // Log detail error untuk debugging
    if (error.details) {
      console.error('   Details:', error.details);
    }
    
    // Return default data jika error
    return {
      activeUsers: 0,
      pageViews: 0,
      lastUpdated: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
      error: error.message
    };
  }
}

/**
 * Format custom report untuk Telegram
 * @param {object} userData - User data
 * @param {object} articleData - GA4 article data
 * @returns {string} Formatted message for Telegram
 */
function formatCustomReport(userData, articleData) {
  const waktuSekarang = new Date().toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  // COMPATIBILITY: handle both old and new format
  const userName = userData.nama || userData.name || 'User';
  const userId = userData.id || 'N/A';
  const shortlink = userData.shortlink || 'Tidak ada';
  
  // Get article title
  let articleTitle = userData.articleTitle;
  if (!articleTitle && userData.destinationUrl) {
    articleTitle = extractTitleFromUrl(userData.destinationUrl);
  }
  
  // Jika masih tidak ada, gunakan default
  articleTitle = articleTitle || 'unknown-article';

  // Format HTML message
  return `
📈 <b>LAPORAN REALTIME - SAAT INI</b>

⏰ <b>Waktu</b>      : <code>${waktuSekarang}</code>
👋 <b>Nama</b>      : ${escapeHtml(userName)}
👥 <b>User ID</b>   : <code>${userId}</code>
👥 <b>Link</b>      : ${shortlink}
👥 <b>Artikel</b>   : ${escapeHtml(articleTitle)}

📊 <b>Active User</b> : <b>${articleData.activeUsers || 0}</b>
👁️ <b>Views</b>      : <b>${articleData.pageViews || 0}</b>

<i>Data 30 hari terakhir untuk artikel di atas</i>
<i>Update terakhir: ${articleData.lastUpdated || waktuSekarang}</i>`;
}

/**
 * Debug function untuk test GA4 connection
 * @param {object} analyticsDataClient - GA4 client
 * @returns {object} Debug info
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
  
  // Helper functions (optional)
  escapeHtml,
  extractPathFromUrl,
  extractTitleFromUrl
};
