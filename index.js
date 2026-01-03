// index.js - Bot GA4 dengan Webhook untuk Render
const TelegramBot = require('node-telegram-bot-api');
const express = require('express'); // Tambah Express untuk server web
const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const { GoogleAuth } = require('google-auth-library');
require('dotenv').config();

// 1. KONFIGURASI
const token = process.env.TELEGRAM_BOT_TOKEN;
const groupChatId = process.env.TELEGRAM_GROUP_CHAT_ID;
const laporanThreadId = process.env.LAPORAN_THREAD_ID;
const ga4PropertyId = process.env.GA4_PROPERTY_ID;

// PENTING: Inisialisasi Bot TANPA Polling
const bot = new TelegramBot(token);

// Inisialisasi Express dan Client GA4
const app = express();
const auth = new GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS), // <-- Baca JSON dari env var
  scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
});
const analyticsDataClient = new BetaAnalyticsDataClient({ auth }); // <-- Berikan auth ke client

// 2. FUNGSI UNTUK MENGAMBIL DATA GA4 (SAMA)
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

// 3. FUNGSI UNTUK MEMFORMAT LAPORAN (SAMA)
function formatLaporan(data) {
  let message = `📊 *LAPORAN REALTIME - 24 JAM TERAKHIR*\n`;
  message += `⏰ ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}\n\n`;

  if (data.topPagesResponse?.rows?.length > 0) {
    message += `🔝 *TOP 5 HALAMAN:*\n`;
    data.topPagesResponse.rows.forEach((row, index) => {
      const pageTitle = row.dimensionValues[0].value || 'Halaman Tanpa Judul';
      const sessions = parseInt(row.metricValues[0].value).toLocaleString('id-ID');
      message += `${index + 1}. ${pageTitle} - ${sessions} sesi\n`;
    });
  } else {
    message += `🔝 *TOP 5 HALAMAN:*\n(tidak ada data)\n`;
  }

  message += `\n`;

  if (data.statsResponse?.rows?.[0]) {
    const stats = data.statsResponse.rows[0].metricValues;
    const formatNumber = (num) => parseInt(num).toLocaleString('id-ID');
    const avgSeconds = parseFloat(stats[3].value);
    const minutes = Math.floor(avgSeconds / 60);
    const seconds = Math.floor(avgSeconds % 60);
    const duration = `${minutes}m ${seconds}s`;

    message += `📈 *STATISTIK:*\n`;
    message += `• Total Sesi: ${formatNumber(stats[0].value)}\n`;
    message += `• User Aktif: ${formatNumber(stats[1].value)}\n`;
    message += `• User Baru: ${formatNumber(stats[2].value)}\n`;
    message += `• Durasi Rata-rata: ${duration}\n`;
  } else {
    message += `📈 *STATISTIK:*\n(tidak ada data)\n`;
  }

  message += `\n🔄 *Laporan berikutnya:* 30 menit lagi\n`;
  message += `📅 ${new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;

  return message;
}

// 4. FUNGSI UNTUK MENGIRIM LAPORAN (SAMA)
async function kirimLaporanOtomatis() {
  console.log(`[${new Date().toISOString()}] Mengambil data GA4 untuk laporan...`);
  
  const data = await fetchGA4Data();
  if (!data) {
    console.error('Gagal mengambil data GA4');
    return;
  }

  const laporan = formatLaporan(data);
  
  try {
    const chatId = laporanThreadId ? groupChatId : groupChatId;
    const options = {
      parse_mode: 'Markdown',
      ...(laporanThreadId && { message_thread_id: parseInt(laporanThreadId) })
    };

    await bot.sendMessage(chatId, laporan, options);
    console.log(`[${new Date().toISOString()}] Laporan berhasil dikirim!`);
  } catch (error) {
    console.error('Error mengirim laporan:', error.response?.body?.description || error.message);
  }
}

// 5. HANDLER PERINTAH DARI TELEGRAM
// PENTING: Semua handler perintah harus didefinisikan SEBELUM webhook aktif

bot.onText(/\/laporan_sekarang/, async (msg) => {
  const chatId = msg.chat.id;
  if (String(chatId) !== groupChatId && !msg.chat.is_forum) return;
  
  await bot.sendMessage(chatId, '🔄 Mengambil data GA4 terbaru...', {
    ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
  });
  
  await kirimLaporanOtomatis();
});

bot.onText(/\/debug_ga4/, async (msg) => {
  const chatId = msg.chat.id;
  const data = await fetchGA4Data();
  
  if (data) {
    await bot.sendMessage(chatId, '✅ Koneksi GA4 berhasil!', {
      parse_mode: 'Markdown',
      ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
    });
  } else {
    await bot.sendMessage(chatId, '❌ Gagal terhubung ke GA4. Periksa kredensial.', {
      ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
    });
  }
});

// --- PERINTAH BARU: /cekvar (GA4 Realtime - Top 10 Pages) ---
bot.onText(/\/cekvar/, async (msg) => {
  const chatId = msg.chat.id;
  const userName = msg.from.first_name || 'Sahabat';

  // Cek apakah perintah berasal dari grup yang benar (opsional)
  if (String(chatId) !== groupChatId) {
    // Bisa juga membalas di chat pribadi dengan pesan berbeda
    return bot.sendMessage(chatId, 'Perintah ini hanya dapat digunakan di grup EatSleepPush.');
  }

  // Kirim pesan "sedang memproses"
  const processingMsg = await bot.sendMessage(chatId, `Halo ${userName}... 🔍 Sedang mengambil data realtime dari GA4...`);

  try {
    // FUNGSI KHUSUS UNTUK MENGAMBIL DATA REAL-TIME 30 MENIT
    const [realtimeResponse] = await analyticsDataClient.runReport({
      property: process.env.GA4_PROPERTY_ID,
      dateRanges: [{ startDate: '30minutesAgo', endDate: 'now' }],
      dimensions: [
        { name: 'pagePath' },      // Path halaman
        { name: 'screenClass' }    // Jenis perangkat (Mobile/Desktop/Tablet)
      ],
      metrics: [
        { name: 'activeUsers' },   // User Aktif (Realtime)
        { name: 'screenPageViews' } // Jumlah Views
      ],
      limit: 10,                    // Ambil 10 data teratas
      orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }] // Urutkan dari ActiveUsers tertinggi
    });

    // FUNGSI UNTUK MEMFORMAT PESAN LAPORAN
    let reportMessage = `📈 *LAPORAN REALTIME - 30 MENIT TERAKHIR*\n`;
    reportMessage += `👋 Permintaan dari: ${userName}\n`;
    reportMessage += `⏰ ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}\n\n`;

    if (realtimeResponse && realtimeResponse.rows && realtimeResponse.rows.length > 0) {
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

      // Tambahkan ringkasan statistik
      const totalActiveUsers = realtimeResponse.rows.reduce((sum, row) => sum + parseInt(row.metricValues[0].value), 0);
      const totalViews = realtimeResponse.rows.reduce((sum, row) => sum + parseInt(row.metricValues[1].value), 0);
      
      reportMessage += `📊 *RINGKASAN:*\n`;
      reportMessage += `   • Total User Aktif (30m): ${totalActiveUsers.toLocaleString('id-ID')}\n`;
      reportMessage += `   • Total Views (30m): ${totalViews.toLocaleString('id-ID')}\n`;

    } else {
      reportMessage += `❌ *Tidak ada data aktif* dalam 30 menit terakhir.\n`;
      reportMessage += `Coba lagi nanti atau periksa koneksi GA4.`;
    }

    // Edit pesan "sedang memproses" dengan hasil laporan
    await bot.editMessageText(reportMessage, {
      chat_id: chatId,
      message_id: processingMsg.message_id,
      parse_mode: 'Markdown'
    });

  } catch (error) {
    console.error('Error dalam perintah /cekvar:', error);
    
    // Kirim pesan error ke pengguna
    await bot.editMessageText(`❌ *Gagal mengambil data realtime.*\n\nError: ${error.message}`, {
      chat_id: chatId,
      message_id: processingMsg.message_id,
      parse_mode: 'Markdown'
    });
  }
});

// 6. KONFIGURASI WEBHOOK DAN SERVER EXPRESS
// PENTING: Middleware untuk parsing JSON request dari Telegram
app.use(express.json());

// Endpoint yang akan menerima update dari Telegram
app.post('/telegram-webhook', (req, res) => {
  bot.processUpdate(req.body); // Proses update yang diterima
  res.sendStatus(200); // Beri respons OK ke Telegram
});

// 7. JALANKAN SERVER DAN SETEL WEBHOOK
const PORT = process.env.PORT || 3000; // Render akan memberikan PORT

app.listen(PORT, async () => {
  console.log(`🤖 Server bot berjalan di port ${PORT}`);

  // PENTING: Setel webhook ke URL aplikasi Anda di Render
  // Variabel RENDER_EXTERNAL_URL akan diatur nanti di dashboard Render
  const webhookUrl = process.env.RENDER_EXTERNAL_URL;
  
  try {
    await bot.setWebHook(webhookUrl);
    console.log(`✅ Webhook berhasil disetel ke: ${webhookUrl}`);
    
    // Kirim pesan startup ke grup setelah webhook siap
    bot.sendMessage(groupChatId, '✅ *Bot Laporan GA4 30-menit telah aktif (Webhook Mode)!*\n\nPerintah tersedia:\n• /laporan_sekarang - Kirim laporan manual\n• /debug_ga4 - Test koneksi GA4', {
      parse_mode: 'Markdown',
      ...(laporanThreadId && { message_thread_id: parseInt(laporanThreadId) })
    }).catch(console.error);
    
  } catch (error) {
    console.error('❌ Gagal menyetel webhook:', error.message);
  }
});

// 8. CATATAN PENTING:
// - CRON JOB DIHAPUS dari file ini. Laporan otomatis akan dijalankan oleh Render Cron Job terpisah.
// - Buat file terpisah `send-report.js` yang hanya berisi fungsi `kirimLaporanOtomatis()`.
// - Di Render, buat Cron Job Service baru yang menjalankan `node send-report.js` setiap 30 menit.
