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
    
    console.log(`🔍 [GA4 Query KEMARIN] untuk: ${userName}`);
    console.log(`   Path: ${pagePath}`);

    if (!pagePath || pagePath === '/') {
      throw new Error('Page path tidak valid');
    }

    // QUERY UNTUK KEMARIN SAJA
    const [response] = await analyticsDataClient.runReport({
      property: `properties/${process.env.GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate: 'yesterday', endDate: 'yesterday' }], // ← HANYA KEMARIN
      dimensions: [{ name: 'pagePath' }],
      metrics: [
        { name: 'activeUsers' },
        { name: 'screenPageViews' },
        { name: 'publisherAdClicks' },
        { name: 'publisherAdImpressions' },
        { name: 'publisherAdRevenue' }
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

    // PROSES DATA KEMARIN
    if (response && response.rows && response.rows.length > 0) {
      const row = response.rows[0];
      const activeUsers = parseInt(row.metricValues[0]?.value) || 0;
      const pageViews = parseInt(row.metricValues[1]?.value) || 0;
      const adClicks = parseInt(row.metricValues[2]?.value) || 0;
      const adImpressions = parseInt(row.metricValues[3]?.value) || 0;
      const adRevenue = parseFloat(row.metricValues[4]?.value) || 0;
      
      console.log(`📈 Hasil: ${activeUsers} users, ${pageViews} views, Revenue: ${adRevenue}`);
      
      return {
        activeUsers: activeUsers,
        pageViews: pageViews,
        adClicks: adClicks,
        adImpressions: adImpressions,
        adRevenue: adRevenue,
        dataDate: getYesterdayDate(), // ← Gunakan tanggal kemarin
        isYesterdayData: true,
        note: 'Data kemarin sudah diproses penuh'
      };
      
    } else {
      console.log(`   ⚠️  Tidak ada data untuk kemarin`);
      
      return {
        activeUsers: 0,
        pageViews: 0,
        adClicks: 0,
        adImpressions: 0,
        adRevenue: 0,
        dataDate: getYesterdayDate(),
        isYesterdayData: true,
        note: 'Belum ada traffic kemarin'
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
      adClicks: 0,
      adImpressions: 0,
      adRevenue: 0,
      dataDate: getYesterdayDate(),
      error: error.message,
      isYesterdayData: true
    };
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
