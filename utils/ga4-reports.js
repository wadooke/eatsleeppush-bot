// utils/ga4-reports.js - FULL VERSION
// Menampilkan Active Users & Views (realtime) + Revenue (kemarin)

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
 * Helper untuk format currency IDR
 */
function formatCurrencyIDR(amount) {
  if (!amount && amount !== 0) return 'Rp 0';
  
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(numericAmount);
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
 * Helper untuk mendapatkan tanggal kemarin dalam format YYYY-MM-DD
 */
function getYesterdayDate() {
  const now = new Date();
  now.setDate(now.getDate() - 1);
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
function getTanggalIndo(dateType = 'today') {
  const date = new Date();
  if (dateType === 'yesterday') {
    date.setDate(date.getDate() - 1);
  }
  
  return date.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

// ============================================
// MAIN GA4 DATA FETCHING FUNCTION
// ============================================

/**
 * Fetch GA4 data - Realtime untuk Users/Views + Standard untuk Revenue (kemarin)
 */
async function fetchUserArticleData(analyticsDataClient, userData) {
  try {
    const pagePath = userData.ga4Path || userData.destinationUrl?.match(/https?:\/\/[^\/]+(\/.*)/)?.[1] || '/';
    const userName = userData.nama || userData.name || 'User';

    console.log(`🔍 [GA4 Query KOMBINASI] untuk: ${userName}`);
    console.log(`   Path: ${pagePath}`);

    if (!pagePath || pagePath === '/') {
      throw new Error('Page path tidak valid');
    }

    // 1. QUERY REALTIME (Active Users & Views - 30m terakhir)
    let realtimeData = { activeUsers: 0, pageViews: 0 };
    
    try {
      console.log(`   📡 Mengambil data realtime...`);
      const [realtimeResponse] = await analyticsDataClient.runRealtimeReport({
        property: `properties/${process.env.GA4_PROPERTY_ID}`,
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

      if (realtimeResponse?.rows?.[0]) {
        const row = realtimeResponse.rows[0];
        realtimeData.activeUsers = parseInt(row.metricValues[0]?.value) || 0;
        realtimeData.pageViews = parseInt(row.metricValues[1]?.value) || 0;
        console.log(`   ✅ Data realtime: ${realtimeData.activeUsers} users, ${realtimeData.pageViews} views`);
      } else {
        console.log(`   ⚠️  Tidak ada data realtime untuk path ini`);
      }
      
    } catch (realtimeError) {
      console.error('   ⚠️  Gagal ambil data realtime:', realtimeError.message);
    }

    // 2. QUERY STANDARD "KEMARIN" (Revenue, Ad Clicks, Impressions)
    let yesterdayData = { adRevenue: 0, adClicks: 0, adImpressions: 0 };
    
    try {
      console.log(`   📅 Mengambil data kemarin (revenue)...`);
      const [standardResponse] = await analyticsDataClient.runReport({
        property: `properties/${process.env.GA4_PROPERTY_ID}`,
        dateRanges: [{ startDate: 'yesterday', endDate: 'yesterday' }],
        dimensions: [{ name: 'pagePath' }],
        metrics: [
          { name: 'publisherAdRevenue' },
          { name: 'publisherAdClicks' },
          { name: 'publisherAdImpressions' }
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

      if (standardResponse?.rows?.[0]) {
        const row = standardResponse.rows[0];
        yesterdayData.adRevenue = parseFloat(row.metricValues[0]?.value) || 0;
        yesterdayData.adClicks = parseInt(row.metricValues[1]?.value) || 0;
        yesterdayData.adImpressions = parseInt(row.metricValues[2]?.value) || 0;
        console.log(`   ✅ Data kemarin: Revenue: ${yesterdayData.adRevenue}, Clicks: ${yesterdayData.adClicks}`);
      } else {
        console.log(`   ⚠️  Tidak ada data revenue kemarin untuk path ini`);
      }
      
    } catch (standardError) {
      console.error('   ❌ Gagal ambil data kemarin:', standardError.message);
      
      if (standardError.message.includes('publisherAdRevenue') || 
          standardError.message.includes('Unrecognized metric')) {
        console.error('   💡 Mungkin metrik publisherAdRevenue belum aktif di GA4');
      }
      
      throw new Error('Gagal mengambil data revenue dari GA4.');
    }

    // 3. GABUNGKAN HASIL KEDUA QUERY
    return {
      activeUsers: realtimeData.activeUsers,
      pageViews: realtimeData.pageViews,
      adRevenue: yesterdayData.adRevenue,
      adClicks: yesterdayData.adClicks,
      adImpressions: yesterdayData.adImpressions,
      dataDate: getTodayDate(),
      yesterdayDate: getYesterdayDate(),
      note: 'Active Users & Views: data 30 menit terakhir. Revenue: data hari kemarin yang telah diproses.',
      success: true
    };

  } catch (error) {
    console.error('❌ Error utama fetchUserArticleData:', error.message);
    
    return {
      activeUsers: 0,
      pageViews: 0,
      adRevenue: 0,
      adClicks: 0,
      adImpressions: 0,
      dataDate: getTodayDate(),
      error: error.message,
      success: false
    };
  }
}

// ============================================
// REPORT FORMATTING FUNCTION
// ============================================

/**
 * Format laporan - Gabungan Realtime + Data Kemarin
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

  // Format tanggal kemarin untuk display
  const tanggalKemarinIndo = getTanggalIndo('yesterday');

  // FORMAT LAPORAN UTAMA
  let reportMessage = `📈 <b>LAPORAN ${waktuSekarang}</b>\n\n`;
  reportMessage += `👤 <b>Nama:</b> ${userName}\n`;
  reportMessage += `👤 <b>ID:</b> ${userId}\n`;
  reportMessage += `🔗 <b>Link:</b> <code>https://${linkDisplay}</code>\n`;
  reportMessage += `📄 <b>Artikel:</b> ${escapeHtml(articleTitle)}\n\n`;
  
  reportMessage += `📊 <b>PERFORMANCE REAL-TIME</b>\n`;
  reportMessage += `👥 <b>Active User:</b> ${articleData.activeUsers || 0} <i>(30 menit terakhir)</i>\n`;
  reportMessage += `👁️ <b>Views:</b> ${articleData.pageViews || 0} <i>(30 menit terakhir)</i>\n\n`;
  
  reportMessage += `💰 <b>REVENUE (${tanggalKemarinIndo})</b>\n`;
  reportMessage += `📈 <b>Revenue:</b> ${formatCurrencyIDR(articleData.adRevenue || 0)}\n`;
  reportMessage += `🖱️ <b>Ad Clicks:</b> ${articleData.adClicks || 0}\n`;
  reportMessage += `👀 <b>Ad Impressions:</b> ${articleData.adImpressions || 0}\n\n`;
  
  if (articleData.error) {
    reportMessage += `⚠️ <b>CATATAN:</b> <code>${escapeHtml(articleData.error)}</code>\n\n`;
  }
  
  reportMessage += `ℹ️ <i>Data real-time update setiap 30 menit.</i>\n`;
  reportMessage += `ℹ️ <i>Data revenue diupdate setiap hari pukul 15:30 WIB.</i>\n\n`;
  reportMessage += `🕐 <i>Laporan dibuat: ${waktuSekarang} WIB</i>`;

  return reportMessage;
}

/**
 * Format laporan sederhana (backward compatibility)
 */
function formatSimpleReport(userData, articleData) {
  const waktuSekarang = getCurrentTimeWIB();
  const userName = escapeHtml(userData.nama || userData.name || 'User');
  
  const shortlink = userData.shortlink || '';
  let linkDisplay = 'Tidak ada';
  if (shortlink) {
    linkDisplay = shortlink.replace(/^https?:\/\//, '');
  }
  
  let articleTitle = userData.articleTitle || 'N/A';
  if (articleTitle.length > 35) {
    articleTitle = articleTitle.substring(0, 32) + '...';
  }

  return `📈 <b>LAPORAN ${waktuSekarang}</b>\n\n` +
         `👤 <b>Nama:</b> ${userName}\n` +
         `👤 <b>ID:</b> ${userData.id}\n` +
         `🔗 <b>Link:</b> <code>https://${linkDisplay}</code>\n` +
         `📄 <b>Artikel:</b> ${escapeHtml(articleTitle)}\n` +
         `👥 <b>Active User:</b> ${articleData.activeUsers || 0}\n` +
         `👁️ <b>Views:</b> ${articleData.pageViews || 0}\n` +
         `💰 <b>Revenue:</b> ${formatCurrencyIDR(articleData.adRevenue || 0)}\n\n` +
         `<i>🕐 ${getTanggalIndo()} | Reset: 00:00 WIB</i>`;
}

// ============================================
// EXPORT FUNCTIONS
// ============================================

module.exports = {
  fetchUserArticleData,
  formatCustomReport,
  formatSimpleReport,
  escapeHtml,
  formatCurrencyIDR,
  getTodayDate,
  getYesterdayDate,
  getCurrentTimeWIB,
  getTanggalIndo
};
