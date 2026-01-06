// utils/ga4-reports.js - COMPLETE VERSION WITH SMALL FONT FORMAT
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

/**
 * Format link untuk tampil sebagai teks (bukan hyperlink)
 * Mencegah Telegram membuat preview gambar
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
    
    // Tampilkan sebagai: https://domain.com/path dalam tag <code>
    return `<code>https://${displayText}</code>`;
    
  } catch {
    // Fallback: escape HTML dan tampilkan sebagai teks
    return `<code>${escapeHtml(url || 'Tidak ada')}</code>`;
  }
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
        console.log(`   ⏰ Breakdown per jam:`, JSON.stringify(hourlyBreakdown));
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
 * Format laporan dengan font kecil (<small> tag) untuk mobile friendly
 */
function formatCustomReport(userData, articleData) {
  const waktuSekarang = getCurrentTimeWIB();
  const userName = escapeHtml(userData.nama || userData.name || 'User');
  const userId = userData.id || 'N/A';
  
  // Format tanggal Indonesia lengkap
  const today = new Date();
  const tanggalIndo = today.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  
  // Shortlink: format sebagai teks (bukan link)
  const shortlink = userData.shortlink || '';
  let linkDisplay = 'Tidak ada';
  if (shortlink) {
    // Hapus https:// untuk display lebih clean
    linkDisplay = shortlink.replace(/^https?:\/\//, '');
  }
  
  // Artikel: potong jika terlalu panjang
  let articleTitle = userData.articleTitle || 'N/A';
  const maxTitleLength = 40; // Sesuaikan dengan lebar mobile
  if (articleTitle.length > maxTitleLength) {
    articleTitle = articleTitle.substring(0, maxTitleLength - 3) + '...';
  }

  // FORMAT DENGAN FONT KECIL (<small> tag) - MOBILE FRIENDLY
  return `
<small><b>📈 LAPORAN REALTIME ${waktuSekarang}</b></small>

<small>👤 <b>Nama</b>       : ${userName}</small>
<small>👤 <b>ID Telegram</b> : ${userId}</small>
<small>🔗 <b>Link</b>      : <code>https://${linkDisplay}</code></small>
<small>📄 <b>Artikel</b>   : ${escapeHtml(articleTitle)}</small>
<small>👥 <b>Active User</b> : ${articleData.activeUsers || 0}</small>
<small>👁️ <b>Views</b>      : ${articleData.pageViews || 0}</small>

<small>🕐 <i>Hari ini | ${tanggalIndo}</i></small>`;
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
  getCurrentTimeWIB
};
