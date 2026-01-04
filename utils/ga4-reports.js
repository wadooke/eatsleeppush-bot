// utils/ga4-reports.js
async function fetchGA4RealtimeData(analyticsDataClient, userName) {
  try {
    const propertyId = process.env.GA4_PROPERTY_ID;
    
    console.log(`   [QUERY] Fetching REALTIME data for property: ${propertyId}`);
    
    const [realtimeResponse] = await analyticsDataClient.runRealtimeReport({
      property: `properties/${propertyId}`,
      dimensions: [{ name: 'unifiedScreenName' }],
      metrics: [
        { name: 'activeUsers' },
        { name: 'screenPageViews' }
      ],
      limit: 10,
      orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }]
    });

    let reportMessage = `📈 *LAPORAN REALTIME - SAAT INI*\n`;
    reportMessage += `👋 Permintaan dari: ${userName}\n`;
    reportMessage += `⏰ ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}\n\n`;

    if (realtimeResponse && realtimeResponse.rows && realtimeResponse.rows.length > 0) {
      reportMessage += `🔝 *10 HALAMAN/SCREEN AKTIF TERATAS:*\n\n`;
      
      realtimeResponse.rows.forEach((row, index) => {
        const screenName = row.dimensionValues[0].value || '(not set)';
        const activeUsers = parseInt(row.metricValues[0].value).toLocaleString('id-ID');
        const views = parseInt(row.metricValues[1].value).toLocaleString('id-ID');
        
        reportMessage += `*${index + 1}. ${screenName}*\n`;
        reportMessage += `   👥 User Aktif: ${activeUsers}\n`;
        reportMessage += `   👁️ Views: ${views}\n\n`;
      });

      const totalActiveUsers = realtimeResponse.rows.reduce((sum, row) => sum + parseInt(row.metricValues[0].value), 0);
      const totalViews = realtimeResponse.rows.reduce((sum, row) => sum + parseInt(row.metricValues[1].value), 0);
      
      reportMessage += `📊 *RINGKASAN:*\n`;
      reportMessage += `   • Total User Aktif: ${totalActiveUsers.toLocaleString('id-ID')}\n`;
      reportMessage += `   • Total Views: ${totalViews.toLocaleString('id-ID')}\n`;

    } else {
      reportMessage += `ℹ️ *Tidak ada user aktif* yang terdeteksi saat ini.\n`;
      reportMessage += `Ini bisa normal jika traffic website Anda sedang rendah.`;
    }

    return reportMessage;
  } catch (error) {
    console.error('❌ [QUERY ERROR] in fetchGA4RealtimeData:');
    console.error('   Message:', error.message);
    if (error.details) {
      if (Array.isArray(error.details)) {
        console.error('   Details:', JSON.stringify(error.details, null, 2));
      } else {
        console.error('   Details:', error.details);
      }
    }
    throw error;
  }
}

// FUNGSI BARU: Ambil data khusus untuk artikel user
async function fetchUserArticleData(analyticsDataClient, userData) {
  try {
    const propertyId = process.env.GA4_PROPERTY_ID;
    
    console.log(`   [QUERY] Fetching data for user: ${userData.nama}`);
    console.log(`   [QUERY] GA4 Path: ${userData.ga4Path}`);
    
    const [response] = await analyticsDataClient.runRealtimeReport({
      property: `properties/${propertyId}`,
      dimensions: [
        { name: 'pagePath' },
        { name: 'pageTitle' }  // AMBIL JUDUL DARI GA4
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
                  matchType: 'CONTAINS',
                  value: userData.ga4Path
                }
              }
            }
          ]
        }
      },
      limit: 1
    });

    // Tentukan judul artikel
    let articleTitle = '';
    let hasArticleData = false;
    let activeUsers = 0;
    let views = 0;
    
    if (response?.rows?.length > 0) {
      const row = response.rows[0];
      // Ambil judul dari GA4 (pageTitle)
      articleTitle = row.dimensionValues[1]?.value || 
                    // Fallback: ekstrak dari path
                    userData.ga4Path.split('/').pop().replace(/-/g, ' ') || 
                    'Artikel';
      activeUsers = parseInt(row.metricValues[0].value);
      views = parseInt(row.metricValues[1].value);
      hasArticleData = true;
    } else {
      // Jika tidak ada data, buat judul dari path
      articleTitle = userData.ga4Path.split('/').pop().replace(/-/g, ' ') || 'Artikel';
      hasArticleData = false;
    }
    
    return {
      hasData: hasArticleData,
      articleTitle: articleTitle,
      activeUsers: activeUsers,
      views: views,
      rows: response?.rows || []
    };
    
  } catch (error) {
    console.error('❌ Error fetching user article data:', error.message);
    throw error;
  }
}

// FUNGSI BARU: Format laporan custom
function formatCustomReport(userData, articleData) {
  const now = new Date();
  const timeOptions = { 
    timeZone: 'Asia/Jakarta', 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit',
    hour12: false 
  };
  const wibTime = now.toLocaleTimeString('id-ID', timeOptions);
  
  // Format judul artikel (capitalize setiap kata)
  const formattedArticleTitle = articleData.articleTitle
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  
  let reportMessage = `📈 *LAPORAN REALTIME - SAAT INI*\n`;
  reportMessage += `⏰ Waktu\t\t: ${wibTime} WIB\n`;
  reportMessage += `👋 Nama\t\t: ${userData.nama}\n`;
  reportMessage += `👥 User ID\t: ${userData.id}\n`;
  reportMessage += `🔗 Link\t\t: ${userData.shortlink}\n\n`;
  
  // Bagian DATA ARTIKEL
  reportMessage += `*📊 DATA ARTIKEL:*\n`;
  reportMessage += `• Halaman\t: ${formattedArticleTitle}\n`;
  
  if (articleData.hasData) {
    reportMessage += `• Active User\t: ${articleData.activeUsers}\n`;
    reportMessage += `• Views\t\t: ${articleData.views}\n`;
  } else {
    reportMessage += `• Active User\t: 0\n`;
    reportMessage += `• Views\t\t: 0\n`;
    reportMessage += `\n_ℹ️ Tidak ada traffic yang terdeteksi untuk halaman ini._`;
  }
  
  return reportMessage;
}

module.exports = {
  fetchGA4RealtimeData,
  fetchUserArticleData,
  formatCustomReport
};
