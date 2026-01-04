// utils/ga4-reports.js - UPDATE UNTUK COMPATIBLE DENGAN FORMAT LAMA
async function fetchUserArticleData(analyticsDataClient, userData) {
  try {
    // COMPATIBILITY: userData bisa dari format lama atau baru
    const pagePath = userData.ga4Path || extractPathFromUrl(userData.destinationUrl || userData.articleUrl);
    const userName = userData.nama || userData.name;
    
    console.log(`🔍 Query GA4 untuk: ${userName}`);
    console.log(`   Path: ${pagePath}`);

    // ... [rest of your GA4 query code] ...
    // Pastikan pagePath di-encode dengan benar
    const encodedPath = encodeURI(pagePath);
    
    // Lanjutkan dengan query GA4...
    
  } catch (error) {
    console.error('❌ Error fetchUserArticleData:', error.message);
    throw error;
  }
}

function formatCustomReport(userData, articleData) {
  const waktuSekarang = new Date().toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const userName = userData.nama || userData.name;
  const userId = userData.id || 'N/A';
  const shortlink = userData.shortlink || 'Tidak ada';
  const articleTitle = userData.articleTitle || 
    (userData.destinationUrl ? extractTitleFromUrl(userData.destinationUrl) : 'unknown');

  return `
📈 <b>LAPORAN REALTIME - SAAT INI</b>
⏰ <b>Waktu</b>      : <code>${waktuSekarang}</code>
👋 <b>Nama</b>      : ${escapeHtml(userName)}
👥 <b>User ID</b>   : <code>${userId}</code>
👥 <b>Link</b>      : ${shortlink}
👥 <b>Artikel</b>   : ${escapeHtml(articleTitle)}
👥 <b>Active User</b> : <b>${articleData.activeUsers || 0}</b>
👥 <b>Views</b>      : <b>${articleData.pageViews || 0}</b>

<i>Data hanya dari artikel: ${escapeHtml(articleTitle)}</i>`;
}

// Helper functions
function extractPathFromUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.pathname;
  } catch {
    return '/';
  }
}

function extractTitleFromUrl(url) {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(p => p);
    return pathParts[pathParts.length - 1] || 'unknown';
  } catch {
    return 'unknown';
  }
}
