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

// Helper untuk format currency IDR
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

// Helper untuk mendapatkan tanggal kemarin dalam format YYYY-MM-DD
function getYesterdayDate() {
  const now = new Date();
  now.setDate(now.getDate() - 1); // Kurangi 1 hari
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
 * Fetch GA4 data untuk KEMARIN (bukan hari ini)
 */
async function fetchUserArticleData(analyticsDataClient, userData) {
  try {
    const pagePath = userData.ga4Path || userData.destinationUrl?.match(/https?:\/\/[^\/]+(\/.*)/)?.[1] || '/';
    const userName = userData.nama || userData.name || 'User';

    console.log(`🔍 [GA4 Query KOMBINASI] untuk: ${userName}`);

    // ---- 1. QUERY REALTIME (Active Users & Views) ----
    let realtimeData = { activeUsers: 0, pageViews: 0 };
    try {
      const [realtimeResponse] = await analyticsDataClient.runRealtimeReport({
        property: `properties/${process.env.GA4_PROPERTY_ID}`,
        dimensions: [{ name: 'pagePath' }],
        metrics: [
          { name: 'activeUsers' }, // Jumlah user aktif 30 menit terakhir[citation:1][citation:3]
          { name: 'screenPageViews' } // Jumlah views 30 menit terakhir[citation:3]
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
      }
      console.log(`📡 Data Realtime: ${realtimeData.activeUsers} users, ${realtimeData.pageViews} views`);
    } catch (realtimeError) {
      console.error('⚠️  Gagal ambil data realtime:', realtimeError.message);
      // Jangan gagal total, lanjut dengan nilai 0 untuk realtime
    }

    // ---- 2. QUERY STANDARD "KEMARIN" (Revenue, dll) ----
    let yesterdayData = { adRevenue: 0, adClicks: 0, adImpressions: 0 };
    try {
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
      }
      console.log(`📅 Data Kemarin: Revenue: ${yesterdayData.adRevenue}`);
    } catch (standardError) {
      console.error('❌ Gagal ambil data kemarin:', standardError.message);
      throw new Error('Gagal mengambil data revenue dari GA4.');
    }

    // ---- GABUNGKAN HASIL ----
    return {
      activeUsers: realtimeData.activeUsers,   // Dari realtime
      pageViews: realtimeData.pageViews,       // Dari realtime
      adRevenue: yesterdayData.adRevenue,      // Dari kemarin
      adClicks: yesterdayData.adClicks,        // Dari kemarin
      adImpressions: yesterdayData.adImpressions, // Dari kemarin
      dataDate: getTodayDate(), // Tanggal laporan (hari ini)
      note: 'Active Users & Views: data 30 menit terakhir. Revenue: data hari kemarin yang telah diproses.'
    };

  } catch (error) {
    console.error('❌ Error utama fetchUserArticleData:', error.message);
    throw error;
  }
}

/**
 * Format laporan - DATA KEMARIN dengan keterangan delay
 */
function formatCustomReport(userData, articleData) {
  const waktuSekarang = getCurrentTimeWIB();
  const userName = escapeHtml(userData.nama || userData.name || 'User');
  const userId = userData.id || 'N/A';
  
  // Ambil data kemarin
  const data = articleData;
  const tanggalLaporan = articleData.dataDate || getYesterdayDate();
  
  // Format tanggal Indonesia untuk display
  const tanggalIndoLaporan = new Date(tanggalLaporan).toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

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

  // FORMAT LAPORAN DENGAN DATA KEMARIN
  return `📈 <b>LAPORAN ${waktuSekarang}</b>

👤 <b>Nama:</b> ${userName}
👤 <b>ID:</b> ${userId}
🔗 <b>Link:</b> <code>https://${linkDisplay}</code>
📄 <b>Artikel:</b> ${escapeHtml(articleTitle)}

📊 <b>DATA TERAKHIR (${tanggalLaporan})</b>
👥 <b>Active User:</b> ${data.activeUsers || 0}
👁️ <b>Views:</b> ${data.pageViews || 0}
💰 <b>Revenue:</b> ${formatCurrencyIDR(data.adRevenue || 0)}
🖱️ <b>Ad Clicks:</b> ${data.adClicks || 0}
👀 <b>Ad Impressions:</b> ${data.adImpressions || 0}

⚠️ <i>Data dihitung per hari sebelumnya pukul 15:30 WIB.</i>
⚠️ <i>Data hari ini masih dalam pemrosesan oleh sistem GA4.</i>

🕐 <i>${tanggalIndoLaporan} | Laporan dibuat: ${waktuSekarang} WIB</i>`;
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
