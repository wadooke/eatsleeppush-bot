// utils/ga4-reports.js - GA4 report functions
async function fetchGA4RealtimeData(analyticsDataClient, userName) {
  try {
    const propertyId = process.env.GA4_PROPERTY_ID;
    
    // PERINGATAN: Kombinasi dimensi & metrik untuk 'now' sangat terbatas.
    // Query 1: Ambil data realtime user aktif & halaman teratas (sederhana)
    console.log(`   [QUERY] Fetching realtime data for property: ${propertyId}`);
    const [realtimeResponse] = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: '30minutesAgo', endDate: 'now' }],
      // Kombinasi yang lebih sederhana dan umumnya didukung
      dimensions: [{ name: 'unifiedScreenName' }], // Nama halaman/creen
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

    if (realtimeResponse && realtimeResponse.rows && realtimeResponse.rows.length > 0) {
      reportMessage += `🔝 *10 HALAMAN/SCREEN TERATAS* (berdasarkan User Aktif):\n\n`;
      
      realtimeResponse.rows.forEach((row, index) => {
        // Gunakan 'unifiedScreenName' sebagai pengganti 'pagePath'
        const screenName = row.dimensionValues[0].value || '(not set)';
        const activeUsers = parseInt(row.metricValues[0].value).toLocaleString('id-ID');
        const views = parseInt(row.metricValues[1].value).toLocaleString('id-ID');
        
        // Tampilkan informasi yang didapat
        reportMessage += `*${index + 1}. ${screenName}*\n`;
        reportMessage += `   👥 User Aktif: ${activeUsers}\n`;
        reportMessage += `   👁️ Views: ${views}\n\n`;
      });

      // Ringkasan statistik
      const totalActiveUsers = realtimeResponse.rows.reduce((sum, row) => sum + parseInt(row.metricValues[0].value), 0);
      const totalViews = realtimeResponse.rows.reduce((sum, row) => sum + parseInt(row.metricValues[1].value), 0);
      
      reportMessage += `📊 *RINGKASAN:*\n`;
      reportMessage += `   • Total User Aktif (30m): ${totalActiveUsers.toLocaleString('id-ID')}\n`;
      reportMessage += `   • Total Views (30m): ${totalViews.toLocaleString('id-ID')}\n`;

    } else {
      reportMessage += `ℹ️ *Tidak ada data aktif* yang tercatat dalam 30 menit terakhir.\n`;
      reportMessage += `Ini bisa normal jika traffic website Anda sedang rendah.`;
    }

    return reportMessage;
  } catch (error) {
    console.error('❌ [QUERY ERROR] in fetchGA4RealtimeData:');
    console.error('   Message:', error.message);
    // Tangkap dan log error detail dengan lebih baik
    if (error.details) {
      console.error('   Details:', JSON.stringify(error.details, null, 2));
      // Tambahkan petunjuk berdasarkan error
      error.details.forEach(detail => {
        if (detail.reason === 'INVALID_ARGUMENT' && detail.metadata) {
          console.error('   🧐 Possible cause: Invalid dimension/metric combination for realtime query.');
          console.error('      Try using only basic dimensions like "unifiedScreenName" or "pageTitle".');
        }
      });
    }
    throw error; // Lempar error kembali agar ditangkap handler /cekvar
  }
}

module.exports = {
  fetchGA4RealtimeData
};
