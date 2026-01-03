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
const pengumumanThreadId = process.env.PENGUMUMAN_THREAD_ID; // Tambahkan ini di .env
const ga4PropertyId = process.env.GA4_PROPERTY_ID;

// Database sederhana untuk menyimpan data user
// Dalam produksi, sebaiknya gunakan database seperti MongoDB atau PostgreSQL
const userDatabase = new Map(); // key: telegramId, value: userData

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

// --- PERINTAH BARU: /daftar ---
bot.onText(/\/daftar (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const adminId = msg.from.id;
  const args = match[1].split(' ');

  // Cek apakah perintah berasal dari grup yang benar
  if (String(chatId) !== groupChatId) {
    return bot.sendMessage(chatId, 'Perintah ini hanya dapat digunakan di grup EatSleepPush.');
  }

  // Cek apakah pengirim adalah admin (Anda bisa menambahkan daftar admin di .env)
  const adminIds = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => id.trim()) : [];
  if (!adminIds.includes(adminId.toString())) {
    return bot.sendMessage(chatId, '❌ Hanya admin yang dapat menggunakan perintah ini.', {
      ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
    });
  }

  // Validasi jumlah argumen
  if (args.length < 4) {
    return bot.sendMessage(chatId, '❌ Format salah! Gunakan: /daftar id_telegram "Nama User" "Link" "Artikel"', {
      ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
    });
  }

  const telegramId = args[0];
  const userName = args[1].replace(/"/g, '');
  const link = args[2].replace(/"/g, '');
  const artikel = args.slice(3).join(' ').replace(/"/g, '');

  // Validasi telegram ID (harus angka)
  if (!/^\d+$/.test(telegramId)) {
    return bot.sendMessage(chatId, '❌ ID Telegram harus berupa angka!', {
      ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
    });
  }

  // Simpan data user ke database
  const userData = {
    id: telegramId,
    nama: userName,
    link: link,
    artikel: artikel,
    tanggalDaftar: new Date().toISOString(),
    didaftarkanOleh: adminId
  };

  userDatabase.set(telegramId, userData);

  // Kirim konfirmasi ke admin
  await bot.sendMessage(chatId, `✅ User berhasil didaftarkan!\n\nID: ${telegramId}\nNama: ${userName}`, {
    ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
  });

  // Kirim pengumuman ke topik PENGUMUMAN
  try {
    const pengumumanMessage = `🎉 *SELAMAT DATANG* 🎉\n\n` +
      `Selamat bergabung di grup kami! Berikut data user baru:\n\n` +
      `👤 *Nama User:* ${userName}\n` +
      `🆔 *ID Telegram:* ${telegramId}\n` +
      `🔗 *Link:* ${link}\n` +
      `📝 *Artikel:* ${artikel}\n\n` +
      `*Tanggal Pendaftaran:* ${new Date().toLocaleDateString('id-ID')}\n` +
      `*Didaftarkan oleh:* Admin`;

    const pengumumanOptions = {
      parse_mode: 'Markdown',
      ...(pengumumanThreadId && { message_thread_id: parseInt(pengumumanThreadId) })
    };

    await bot.sendMessage(groupChatId, pengumumanMessage, pengumumanOptions);
    console.log(`✅ Pengumuman user baru berhasil dikirim: ${userName}`);
    
  } catch (error) {
    console.error('Error mengirim pengumuman:', error);
    await bot.sendMessage(chatId, '⚠️ User berhasil didaftarkan, tetapi gagal mengirim pengumuman.', {
      ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
    });
  }
});

// --- PERINTAH BARU: /userid ---
bot.onText(/\/userid/, async (msg) => {
  const chatId = msg.chat.id;
  
  // Cek apakah perintah berasal dari grup yang benar
  if (String(chatId) !== groupChatId) {
    return bot.sendMessage(chatId, 'Perintah ini hanya dapat digunakan di grup EatSleepPush.');
  }

  // Kirim ID telegram pengguna yang mengetik perintah
  const userId = msg.from.id;
  const userName = msg.from.first_name || 'User';
  
  await bot.sendMessage(chatId, `👤 *ID Telegram Anda:*\n${userId}\n\n*Nama:* ${userName}\n\nSalin ID ini untuk pendaftaran.`, {
    parse_mode: 'Markdown',
    ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
  });
});

// --- PERINTAH BARU: /lihat_user (untuk admin melihat user terdaftar) ---
bot.onText(/\/lihat_user/, async (msg) => {
  const chatId = msg.chat.id;
  const adminId = msg.from.id;

  // Cek apakah pengirim adalah admin
  const adminIds = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => id.trim()) : [];
  if (!adminIds.includes(adminId.toString())) {
    return bot.sendMessage(chatId, '❌ Hanya admin yang dapat menggunakan perintah ini.', {
      ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
    });
  }

  if (userDatabase.size === 0) {
    return bot.sendMessage(chatId, '📭 Belum ada user yang terdaftar.', {
      ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
    });
  }

  let userList = `📋 *DAFTAR USER TERDAFTAR* (${userDatabase.size} user)\n\n`;
  
  let index = 1;
  for (const [userId, userData] of userDatabase) {
    userList += `${index}. *${userData.nama}*\n`;
    userList += `   ID: ${userId}\n`;
    userList += `   Link: ${userData.link}\n`;
    userList += `   Artikel: ${userData.artikel.substring(0, 50)}${userData.artikel.length > 50 ? '...' : ''}\n`;
    userList += `   Tanggal: ${new Date(userData.tanggalDaftar).toLocaleDateString('id-ID')}\n\n`;
    index++;
  }

  await bot.sendMessage(chatId, userList, {
    parse_mode: 'Markdown',
    ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
  });
});

// --- PERINTAH BARU: /hapus_user (untuk admin menghapus user) ---
bot.onText(/\/hapus_user (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const adminId = msg.from.id;
  const userIdToDelete = match[1].trim();

  // Cek apakah pengirim adalah admin
  const adminIds = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => id.trim()) : [];
  if (!adminIds.includes(adminId.toString())) {
    return bot.sendMessage(chatId, '❌ Hanya admin yang dapat menggunakan perintah ini.', {
      ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
    });
  }

  if (!userDatabase.has(userIdToDelete)) {
    return bot.sendMessage(chatId, '❌ User tidak ditemukan dalam database.', {
      ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
    });
  }

  const deletedUser = userDatabase.get(userIdToDelete);
  userDatabase.delete(userIdToDelete);

  await bot.sendMessage(chatId, `✅ User berhasil dihapus!\n\n*Nama:* ${deletedUser.nama}\n*ID:* ${userIdToDelete}`, {
    parse_mode: 'Markdown',
    ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
  });
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
    bot.sendMessage(groupChatId, '✅ *Bot Laporan GA4 30-menit telah aktif (Webhook Mode)!*\n\nPerintah tersedia:\n• /laporan_sekarang - Kirim laporan manual\n• /debug_ga4 - Test koneksi GA4\n• /userid - Lihat ID Telegram Anda\n• /cekvar - Laporan realtime 30 menit\n\n*Perintah Admin:*\n• /daftar id "Nama" "Link" "Artikel"\n• /lihat_user - Lihat semua user terdaftar\n• /hapus_user id - Hapus user dari database', {
      parse_mode: 'Markdown',
      ...(laporanThreadId && { message_thread_id: parseInt(laporanThreadId) })
    }).catch(console.error);
    
  } catch (error) {
    console.error('❌ Gagal menyetel webhook:', error.message);
  }
});

// 8. Fungsi tambahan untuk mendapatkan info user saat join group
bot.on('new_chat_members', (msg) => {
  const chatId = msg.chat.id;
  
  // Cek apakah event berasal dari grup yang benar
  if (String(chatId) !== groupChatId) return;

  msg.new_chat_members.forEach((member) => {
    // Jangan respon jika bot sendiri yang join
    if (member.id === bot.getMe().then(me => me.id)) return;

    const userId = member.id;
    const userName = member.first_name || 'User';
    
    // Kirim ID user ke grup untuk admin
    const adminMessage = `👤 *User Baru Bergabung*\n\n` +
      `Nama: ${userName}\n` +
      `ID: ${userId}\n\n` +
      `Untuk mendaftarkan user ini, gunakan perintah:\n` +
      `/daftar ${userId} "Nama User" "Link" "Artikel"`;
    
    // Kirim ke thread laporan atau chat biasa
    bot.sendMessage(chatId, adminMessage, {
      parse_mode: 'Markdown',
      ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
    }).catch(console.error);
  });
});

// 9. Simpan data ke file saat server berhenti (opsional)
process.on('SIGINT', () => {
  console.log('Menyimpan data user sebelum shutdown...');
  // Di sini Anda bisa menambahkan logika untuk menyimpan data ke file
  process.exit(0);
});
