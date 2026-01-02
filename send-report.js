// send-report.js - Script khusus untuk Render Cron Job
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { BetaAnalyticsDataClient } = require('@google-analytics/data');

// Ambil konfigurasi dari environment variables
const token = process.env.TELEGRAM_BOT_TOKEN;
const groupChatId = process.env.TELEGRAM_GROUP_CHAT_ID;
const laporanThreadId = process.env.LAPORAN_THREAD_ID;

const bot = new TelegramBot(token);
const analyticsDataClient = new BetaAnalyticsDataClient();

// --- SALIN 3 FUNGSI UTAMA DARI INDEX.JS LAMA ANDA KE SINI ---
// 1. Fungsi fetchGA4Data()
async function fetchGA4Data() {
  try {
    const [topPagesResponse] = await analyticsDataClient.runReport({
      property: process.env.GA4_PROPERTY_ID,
      dateRanges: [{ startDate: '1daysAgo', endDate: 'today' }],
      dimensions: [{ name: 'pageTitle' }],
      metrics: [{ name: 'sessions' }],
      dimensionFilter: {
        filter: {
          fieldName: 'pageTitle',
          stringFilter: { matchType: 'CONTAINS', value: '' }
        }
      },
      limit: 5,
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }]
    });

    const [statsResponse] = await analyticsDataClient.runReport({
      property: process.env.GA4_PROPERTY_ID,
      dateRanges: [{ startDate: 'today', endDate: 'today' }],
      metrics: [
        { name: 'sessions' },
        { name: 'activeUsers' },
        { name: 'newUsers' },
        { name: 'averageSessionDuration' }
      ]
    });
    return { topPagesResponse, statsResponse };
  } catch (error) {
    console.error('Error mengambil data GA4:', error);
    return null;
  }
}

// 2. Fungsi formatLaporan(data)
function formatLaporan(data) {
  // ... (salin persis dari index.js lama Anda)
}

// 3. Fungsi utama kirimLaporanOtomatis()
async function kirimLaporanOtomatis() {
  console.log(`[${new Date().toISOString()}] Render Cron: Mengambil data GA4...`);
  const data = await fetchGA4Data();
  if (!data) {
    console.error('Gagal mengambil data GA4');
    return;
  }
  const laporan = formatLaporan(data);
  try {
    const options = {
      parse_mode: 'Markdown',
      ...(laporanThreadId && { message_thread_id: parseInt(laporanThreadId) })
    };
    await bot.sendMessage(groupChatId, laporan, options);
    console.log(`[${new Date().toISOString()}] Render Cron: Laporan berhasil dikirim!`);
  } catch (error) {
    console.error('Error mengirim laporan:', error.message);
  }
}

// --- JALANKAN SEKARANG ---
kirimLaporanOtomatis();