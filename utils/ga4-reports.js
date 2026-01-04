// utils/ga4-reports.js - FUNGSI DIPERBAIKI
async function fetchUserArticleData(analyticsDataClient, userData) {
  try {
    // 1. EKSTRAK PATH DARI URL ARTIKEL
    // Dari: "https://eatsleeppush.com/pml/west-african-flavors-jollof-egusi-suya-guide/"
    // Ambil: "/pml/west-african-flavors-jollof-egusi-suya-guide/"
    const urlObj = new URL(userData.articleUrl);
    const pagePath = urlObj.pathname; // Hasil: "/pml/west-african-flavors-jollof-egusi-suya-guide/"
    
    console.log(`🔍 Query GA4 untuk: ${userData.name}`);
    console.log(`   Path: ${pagePath}`);
    console.log(`   Timezone: Asia/Jakarta`);

    // 2. BUAT QUERY UNTUK SATU ARTIKEL SAJA
    const [response] = await analyticsDataClient.runReport({
      property: `properties/${process.env.GA4_PROPERTY_ID}`,
      dateRanges: [{
        startDate: '2024-01-01', // Atau gunakan tanggal mulai campaign
        endDate: 'today',
      }],
      dimensions: [
        { name: 'pagePath' },
        { name: 'pageTitle' },
        { name: 'date' },
        { name: 'hour' }
      ],
      metrics: [
        { name: 'activeUsers' },
        { name: 'screenPageViews' }
      ],
      dimensionFilter: {
        filter: {
          fieldName: 'pagePath',
          stringFilter: {
            matchType: 'EXACT', // PASTIKAN EXACT MATCH
            value: pagePath,
            caseSensitive: false
          }
        }
      },
      orderBys: [
        { dimension: { dimensionName: 'date' }, desc: true },
        { dimension: { dimensionName: 'hour' }, desc: true }
      ],
      limit: 1 // Hanya ambil data terbaru
    });

    // 3. PROSES RESPONSE
    if (!response || !response.rows || response.rows.length === 0) {
      console.log(`⚠️  Tidak ada data GA4 untuk path: ${pagePath}`);
      return {
        activeUsers: 0,
        pageViews: 0,
        lastUpdated: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
      };
    }

    const row = response.rows[0];
    return {
      activeUsers: parseInt(row.metricValues[0].value) || 0,
      pageViews: parseInt(row.metricValues[1].value) || 0,
      lastUpdated: new Date().toLocaleString('id-ID', { 
        timeZone: 'Asia/Jakarta',
        hour12: false 
      })
    };

  } catch (error) {
    console.error('❌ Error fetchUserArticleData:', error.message);
    if (error.details) console.error('   Details:', error.details);
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

  // FORMAT HTML YANG AMAN
  return `
📈 <b>LAPORAN REALTIME - SAAT INI</b>
⏰ <b>Waktu</b>      : <code>${waktuSekarang}</code>
👋 <b>Nama</b>      : ${escapeHtml(userData.name)}
👥 <b>User ID</b>   : <code>${userData.id}</code>
👥 <b>Link</b>      : ${userData.shortlink || 'Tidak ada'}
👥 <b>Artikel</b>   : ${escapeHtml(userData.articleTitle)}
👥 <b>Active User</b> : <b>${articleData.activeUsers}</b>
👥 <b>Views</b>      : <b>${articleData.pageViews}</b>

<i>Data hanya dari artikel: ${escapeHtml(userData.articleTitle)}</i>`;
}
