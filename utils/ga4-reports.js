// utils/ga4-reports.js - GA4 report functions
async function fetchGA4RealtimeData(analyticsDataClient, userName) {
  try {
    const [realtimeResponse] = await analyticsDataClient.runReport({
      property: `properties/${process.env.GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate: '30minutesAgo', endDate: 'now' }],
      dimensions: [
        { name: 'pagePath' },
        { name: 'screenClass' }
      ],
      metrics: [
        { name: 'activeUsers' },
        { name: 'screenPageViews' }
      ],
      limit: 10,
      orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }]
    });

    let reportMessage = `📈 *LAPORAN REALTIME - 30 MENIT TERAKHIR*\n`;
    reportMessage += `👋 Permintaan dari: ${userName}\n`;
    reportMessage += `⏰ ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}\n\n`;

    if (realtimeResponse?.rows?.length > 0) {
      reportMessage += `🔝 *10 HALAMAN TERATAS* (berdasarkan User Aktif):\n\n`;
      
      realtimeResponse.rows.forEach((row, index) => {
        const pagePath = row.dimensionValues[0].value || '/';
        const screenClass = row.dimensionValues[1].value || 'Unknown';
        const activeUsers = parseInt(row.metricValues[0].value).toLocaleString('id-ID');
        const views = parseInt(row.metricValues[1].value).toLocaleString('id-ID');
        
        reportMessage += `*${index + 1}. ${pagePath}*\n`;
        reportMessage += `   📱 Perangkat: ${screenClass}\n`;
        reportMessage += `   👥 User Aktif: ${activeUsers}\n`;
        reportMessage += `   👁️ Views: ${views}\n\n`;
      });

      const totalActiveUsers = realtimeResponse.rows.reduce((sum, row) => sum + parseInt(row.metricValues[0].value), 0);
      const totalViews = realtimeResponse.rows.reduce((sum, row) => sum + parseInt(row.metricValues[1].value), 0);
      
      reportMessage += `📊 *RINGKASAN:*\n`;
      reportMessage += `   • Total User Aktif (30m): ${totalActiveUsers.toLocaleString('id-ID')}\n`;
      reportMessage += `   • Total Views (30m): ${totalViews.toLocaleString('id-ID')}\n`;
    } else {
      reportMessage += `❌ *Tidak ada data aktif* dalam 30 menit terakhir.\n`;
      reportMessage += `Coba lagi nanti atau periksa koneksi GA4.`;
    }

    return reportMessage;
  } catch (error) {
    throw error;
  }
}

module.exports = {
  fetchGA4RealtimeData
};
