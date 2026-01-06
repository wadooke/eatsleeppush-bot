// utils/ga4-reports.js - UPDATE UNTUK LAPORAN HARIAN
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

// Extract domain dari shortlink (tanpa https://)
function extractShortlinkDisplay(shortlink) {
  try {
    if (!shortlink) return 'N/A';
    
    // Hapus https:// atau http://
    let display = shortlink;
    if (display.startsWith('https://')) {
      display = display.substring(8);
    } else if (display.startsWith('http://')) {
      display = display.substring(7);
    }
    
    // Hapus www. jika ada
    if (display.startsWith('www.')) {
      display = display.substring(4);
    }
    
    return display;
  } catch {
    // Jika parsing gagal, return asli tanpa https://
    return shortlink ? shortlink.replace(/^https?:\/\//, '') : 'N/A';
  }
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

/**
 * Fetch GA4 data untuk hari ini saja (00:00 - 23:59 WIB)
 * Data akan reset otomatis tiap hari
 */
async function fetchUserArticleData(analyticsDataClient, userData) {
  try {
    const pagePath = userData.ga4Path || userData.destinationUrl?.match(/https?:\/\/[^\/]+(\/.*)/)?.[1] || '/';
    const userName = userData.nama || userData.name || 'User';
    
    console.log(`🔍 [GA4 Query HARIAN] untuk: ${userName}`);
    console.log(`   Path: ${pagePath}`);
    console.log(`   Periode: Hari ini (00:00 - 23:59 WIB)`);

    if (!pagePath || pagePath === '/') {
      throw new Error('Page path tidak valid');
    }

    // QUERY UNTUK HARI INI SAJA (00:00 - sekarang)
    const [response] = await analyticsDataClient.runReport({
      property: `properties/${process.env.GA4_PROPERTY_ID}`,
      dateRanges: [{
        startDate: 'today', // 00:00 WIB hari ini
        endDate: 'today',   // sampai sekarang
      }],
      dimensions: [
        { name: 'pagePath' },
        { name: 'hour' } // Ambil per jam untuk tracking
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
        { dimension: { dimensionName: 'hour' }, desc: false }
      ],
      limit: 24 // Maks 24 jam data
    });

    // PROSES DATA HARIAN
    let dailyActiveUsers = 0;
    let dailyPageViews = 0;
    let hourlyBreakdown = [];
    
    if (response && response.rows && response.rows.length > 0) {
      console.log(`   📊 Data ditemukan: ${response.rows.length} baris data`);
      
      response.rows.forEach(row => {
        const hour = parseInt(row.dimensionValues[1]?.value) || 0;
        const activeUsers = parseInt(row.metricValues[0]?.value) || 0;
        const pageViews = parseInt(row.metricValues[1]?.value) || 0;
        
        dailyActiveUsers += activeUsers;
        dailyPageViews += pageViews;
        
        // Simpan breakdown per jam (untuk logging)
        if (activeUsers > 0 || pageViews > 0) {
          hourlyBreakdown.push({ 
            hour: `${hour}:00`, 
            activeUsers, 
            pageViews 
          });
        }
      });
      
      console.log(`   📈 Hasil: ${dailyActiveUsers} active users, ${dailyPageViews} page views`);
      
      if (hourlyBreakdown.length > 0) {
        console.log(`   ⏰ Breakdown per jam:`, hourlyBreakdown);
      }
      
      return {
        activeUsers: dailyActiveUsers,
        pageViews: dailyPageViews,
        dataDate: getTodayDate(),
        dataPeriod: '00:00 - ' + getCurrentTimeWIB() + ' WIB',
        hourlyBreakdown: hourlyBreakdown,
        isTodayData: true,
        note: 'Data akan reset otomatis pada pukul 00:00 WIB'
      };
      
    } else {
      console.log(`   ⚠️  Tidak ada data untuk hari ini`);
      
      return {
        activeUsers: 0,
        pageViews: 0,
        dataDate: getTodayDate(),
        dataPeriod: '00:00 - ' + getCurrentTimeWIB() + ' WIB',
        isTodayData: true,
        note: 'Belum ada traffic untuk artikel ini hari ini'
      };
    }

  } catch (error) {
    console.error('❌ Error fetchUserArticleData:', error.message);
    
    // Log detail error untuk debugging
    if (error.details) {
      console.error('   Details:', error.details);
    }
    
    // Return default data dengan info error
    return {
      activeUsers: 0,
      pageViews: 0,
      dataDate: getTodayDate(),
      dataPeriod: '00:00 - ' + getCurrentTimeWIB() + ' WIB',
      error: error.message,
      isTodayData: true
    };
  }
}

/**
 * Format laporan HARIAN sesuai permintaan
 */
function formatCustomReport(userData, articleData) {
  // Format waktu sekarang
  const waktuSekarang = getCurrentTimeWIB();

  const userName = userData.nama || userData.name || 'User';
  const userId = userData.id || 'N/A';
  
  // Shortlink: tampilkan tanpa https:// (contoh: wa-me.cloud/bin001)
  const shortlink = userData.shortlink || '';
  const shortlinkDisplay = extractShortlinkDisplay(shortlink);
  
  const articleTitle = userData.articleTitle || 
    (userData.destinationUrl ? 
      userData.destinationUrl.split('/').filter(p => p).pop() || 'unknown' 
      : 'unknown'
    );

  // Format laporan SIMPLE
  return `
📈 <b>LAPORAN REALTIME - SAAT INI</b>
⏰ <b>Waktu</b>      : ${waktuSekarang}
👋 <b>Nama</b>      : ${escapeHtml(userName)}
👥 <b>User ID</b>   : ${userId}
👥 <b>Link</b>      : ${shortlinkDisplay}
👥 <b>Artikel</b>   : ${escapeHtml(articleTitle)}
📊 <b>Active User</b> : ${articleData.activeUsers || 0}
👁️ <b>Views</b>      : ${articleData.pageViews || 0}

<i>Periode: ${articleData.dataPeriod || 'Hari ini'} (reset 00:00 WIB)</i>`;
}

// Export functions
module.exports = {
  fetchUserArticleData,
  formatCustomReport,
  escapeHtml,
  extractShortlinkDisplay,
  getTodayDate,
  getCurrentTimeWIB
};
