// utils/ga4-reports.js - GA4 report functions
async function fetchGA4RealtimeData(analyticsDataClient, userName) {
  try {
    const propertyId = process.env.GA4_PROPERTY_ID;
    
    console.log(`   [QUERY] Fetching REALTIME data for property: ${propertyId}`);
    
    // GUNAKAN runRealtimeReport, BUKAN runReport
    const [realtimeResponse] = await analyticsDataClient.runRealtimeReport({
      property: `properties/${propertyId}`,
      // Untuk runRealtimeReport, TIDAK PERLU parameter dateRanges
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
      reportMessage += `🔝 *10 HALAMAN/SCREEN AKTIF TERATAS*:\n\n`;
      
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
    // Tangani error details dengan benar (bisa berupa string atau array)
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

module.exports = {
  fetchGA4RealtimeData
};
