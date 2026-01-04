// utils/ga4-reports.js - UPDATE UNTUK FORMAT BARU
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

// Extract domain dari shortlink
function extractShortlinkDomain(shortlink) {
  try {
    if (!shortlink) return 'N/A';
    const url = new URL(shortlink);
    // Ambil hanya domain utama (contoh: wa-me.cloud)
    return url.hostname;
  } catch {
    // Jika bukan URL valid, ambil bagian terakhir setelah slash
    const parts = shortlink.split('/');
    return parts[parts.length - 1] || shortlink;
  }
}

// Extract path terakhir dari shortlink
function extractShortlinkPath(shortlink) {
  try {
    if (!shortlink) return 'N/A';
    const url = new URL(shortlink);
    const pathParts = url.pathname.split('/').filter(p => p);
    return pathParts[pathParts.length - 1] || 'N/A';
  } catch {
    const parts = shortlink.split('/');
    return parts[parts.length - 1] || shortlink;
  }
}

/**
 * Fetch GA4 data untuk hari ini saja (realtime-ish)
 */
async function fetchUserArticleData(analyticsDataClient, userData) {
  try {
    const pagePath = userData.ga4Path || userData.destinationUrl?.match(/https?:\/\/[^\/]+(\/.*)/)?.[1] || '/';
    const userName = userData.nama || userData.name || 'User';
    const userId = userData.id || 'N/A';
    
    console.log(`🔍 [GA4 Query REALTIME] untuk: ${userName} (ID: ${userId})`);
    console.log(`   Path: ${pagePath}`);

    if (!pagePath || pagePath === '/') {
      throw new Error('Page path tidak valid');
    }

    // QUERY UNTUK HARI INI SAJA (realtime-ish)
    const [response] = await analyticsDataClient.runReport({
      property: `properties/${process.env.GA4_PROPERTY_ID}`,
      dateRanges: [{
        startDate: 'today', // HARI INI SAJA
        endDate: 'today',
      }],
      dimensions: [
        { name: 'pagePath' },
        { name: 'pageTitle' },
        { name: 'hour' } // Tambah hour untuk detail
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
        { dimension: { dimensionName: 'hour' }, desc: true }
      ],
      limit: 24 // Max 24 jam
    });

    // PROSES DATA HARI INI
    let todayActiveUsers = 0;
    let todayPageViews = 0;
    let hourlyData = [];
    
    if (response && response.rows && response.rows.length > 0) {
      response.rows.forEach(row => {
        const hour = row.dimensionValues[2]?.value || '0';
        const activeUsers = parseInt(row.metricValues[0]?.value) || 0;
        const pageViews = parseInt(row.metricValues[1]?.value) || 0;
        
        todayActiveUsers += activeUsers;
        todayPageViews += pageViews;
        
        hourlyData.push({ hour, activeUsers, pageViews });
      });
      
      console.log(`   📊 Hari ini: ${todayActiveUsers} users, ${todayPageViews} views`);
      
      // Cari jam dengan traffic tertinggi
      const peakHour = hourlyData.reduce((max, curr) => 
        curr.activeUsers > max.activeUsers ? curr : max, 
        { hour: '0', activeUsers: 0 }
      );
      
      return {
        activeUsers: todayActiveUsers,
        pageViews: todayPageViews,
        lastUpdated: new Date().toLocaleString('id-ID', { 
          timeZone: 'Asia/Jakarta',
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }),
        hourlyData: hourlyData,
        peakHour: peakHour.hour,
        isTodayData: true
      };
      
    } else {
      console.log(`   ⚠️  Tidak ada data untuk hari ini`);
      
      // FALLBACK: Coba ambil data 7 hari terakhir
      const [fallbackResponse] = await analyticsDataClient.runReport({
        property: `properties/${process.env.GA4_PROPERTY_ID}`,
        dateRanges: [{
          startDate: '7daysAgo',
          endDate: 'today',
        }],
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

      let fallbackUsers = 0;
      let fallbackViews = 0;
      
      if (fallbackResponse?.rows?.length > 0) {
        fallbackUsers = parseInt(fallbackResponse.rows[0].metricValues[0]?.value) || 0;
        fallbackViews = parseInt(fallbackResponse.rows[0].metricValues[1]?.value) || 0;
      }
      
      return {
        activeUsers: fallbackUsers,
        pageViews: fallbackViews,
        lastUpdated: new Date().toLocaleString('id-ID', { 
          timeZone: 'Asia/Jakarta',
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }),
        isTodayData: false,
        note: 'Data 7 hari terakhir (tidak ada data hari ini)'
      };
    }

  } catch (error) {
    console.error('❌ Error fetchUserArticleData:', error.message);
    return {
      activeUsers: 0,
      pageViews: 0,
      lastUpdated: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
      error: error.message,
      isTodayData: false
    };
  }
}

/**
 * Format laporan sesuai permintaan
 */
function formatCustomReport(userData, articleData) {
  // Format waktu: 01:56:47 (bukan 01.56.47)
  const waktuSekarang = new Date().toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour12: false,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).replace(',', '').replace(/\./g, ':'); // Ganti . dengan :
  
  // Split untuk ambil waktu saja
  const waktuParts = waktuSekarang.split(' ');
  const waktu = waktuParts.length > 1 ? waktuParts[1] : waktuSekarang;

  const userName = userData.nama || userData.name || 'User';
  const userId = userData.id || '8462501080'; // Default jika tidak ada
  
  // Shortlink: ambil hanya path terakhir (contoh: bin001)
  const shortlink = userData.shortlink || '';
  const shortlinkDisplay = extractShortlinkPath(shortlink);
  
  const articleTitle = userData.articleTitle || 
    (userData.destinationUrl ? 
      userData.destinationUrl.split('/').filter(p => p).pop() || 'unknown' 
      : 'unknown'
    );

  // Data period
  const dataPeriod = articleData.isTodayData ? 
    'Data realtime hari ini' : 
    (articleData.note || 'Data 7 hari terakhir');

  // Format laporan
  return `
📈 <b>LAPORAN REALTIME - SAAT INI</b>

⏰ <b>Waktu</b>      : ${waktu}
👋 <b>Nama</b>      : ${escapeHtml(userName)}
👥 <b>User ID</b>   : ${userId}
👥 <b>Link</b>      : ${shortlinkDisplay}
👥 <b>Artikel</b>   : ${escapeHtml(articleTitle)}

📊 <b>Active User</b> : <b>${articleData.activeUsers || 0}</b>
👁️ <b>Views</b>      : <b>${articleData.pageViews || 0}</b>

<i>${dataPeriod}</i>
<i>Hanya untuk artikel: ${escapeHtml(articleTitle)}</i>`;
}

// Export functions
module.exports = {
  fetchUserArticleData,
  formatCustomReport,
  escapeHtml,
  extractShortlinkDomain,
  extractShortlinkPath
};
