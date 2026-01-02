// index.js - Bot GA4 dengan Webhook untuk Render
const TelegramBot = require('node-telegram-bot-api');
const express = require('express'); // Tambah Express untuk server web
const { BetaAnalyticsDataClient } = require('@google-analytics/data');
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
const analyticsDataClient = new BetaAnalyticsDataClient();

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
  const webhookUrl = `${process.env.RENDER_EXTERNAL_URL}/telegram-webhook`;
  
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