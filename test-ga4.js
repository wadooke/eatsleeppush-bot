// test-ga4.js
const { BetaAnalyticsDataClient } = require('@google-analytics/data');
require('dotenv').config();

console.log('🔍 Mencoba terhubung ke GA4...');
console.log('Properti ID:', process.env.GA4_PROPERTY_ID);
console.log('Kredensial dari:', process.env.GOOGLE_APPLICATION_CREDENTIALS);

const analyticsDataClient = new BetaAnalyticsDataClient();

async function testConnection() {
  try {
    // Coba request yang sangat sederhana
    const [response] = await analyticsDataClient.runReport({
      property: process.env.GA4_PROPERTY_ID,
      dateRanges: [{ startDate: '2024-01-01', endDate: 'today' }],
      metrics: [{ name: 'activeUsers' }],
    });
    console.log('✅ Koneksi BERHASIL!');
    console.log('Contoh data:', response.rows ? response.rows[0] : 'Tidak ada data');
  } catch (error) {
    console.error('❌ Koneksi GAGAL!');
    console.error('Kode Error:', error.code);
    console.error('Pesan Error:', error.message);
    // Detail sering ada di metadata error
    if (error.details) {
      console.error('Detail Error:', error.details);
    }
  }
}

testConnection();