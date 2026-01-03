// index.js - Bot GA4 dengan Webhook untuk Railway
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const { GoogleAuth } = require('google-auth-library');

// 1. KONFIGURASI
const token = process.env.TELEGRAM_BOT_TOKEN;
const groupChatId = process.env.TELEGRAM_GROUP_CHAT_ID;
const laporanThreadId = process.env.LAPORAN_THREAD_ID;
const pengumumanThreadId = process.env.PENGUMUMAN_THREAD_ID;
const ga4PropertyId = process.env.GA4_PROPERTY_ID;

// Database sederhana untuk menyimpan data user
const userDatabase = new Map();

// PENTING: Inisialisasi Bot TANPA Polling (hanya webhook)
const bot = new TelegramBot(token, { 
  polling: false,
  onlyFirstMatch: true
});

// Inisialisasi Express dan Client GA4
const app = express();
let analyticsDataClient;

// Inisialisasi GA4 client dengan error handling
try {
  const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS || '{}');
  if (Object.keys(credentials).length === 0) {
    console.error('GOOGLE_APPLICATION_CREDENTIALS tidak ditemukan atau kosong');
  } else {
    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
    });
    analyticsDataClient = new BetaAnalyticsDataClient({ auth });
    console.log('✅ GA4 Client berhasil diinisialisasi');
  }
} catch (error) {
  console.error('❌ Gagal menginisialisasi GA4 Client:', error.message);
  analyticsDataClient = null;
}

// 2. FUNGSI UNTUK MENGAMBIL DATA GA4 dengan error handling
async function fetchGA4Data() {
  if (!analyticsDataClient) {
    console.error('GA4 Client belum diinisialisasi');
    return null;
  }

  try {
    const [topPagesResponse] = await analyticsDataClient.runReport({
      property: `properties/${ga4PropertyId}`,
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
      property: `properties/${ga4PropertyId}`,
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
    console.error('Error mengambil data GA4:', error.message);
    return null;
  }
}

// 3. FUNGSI UNTUK MEMFORMAT LAPORAN
function formatLaporan(data) {
  let message = `📊 *LAPORAN REALTIME - 24 JAM TERAKHIR*\n`;
  message += `⏰ ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}\n\n`;

  if (data?.topPagesResponse?.rows?.length > 0) {
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

  if (data?.statsResponse?.rows?.[0]) {
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

// 4. FUNGSI UNTUK MENGIRIM LAPORAN dengan error handling
async function kirimLaporanOtomatis() {
  console.log(`[${new Date().toLocaleTimeString('id-ID')}] Mengambil data GA4 untuk laporan...`);
  
  const data = await fetchGA4Data();
  if (!data) {
    console.error('Gagal mengambil data GA4');
    return;
  }

  const laporan = formatLaporan(data);
  
  try {
    const chatId = groupChatId;
    const options = {
      parse_mode: 'Markdown',
      ...(laporanThreadId && { message_thread_id: parseInt(laporanThreadId) })
    };

    await bot.sendMessage(chatId, laporan, options);
    console.log(`[${new Date().toLocaleTimeString('id-ID')}] Laporan berhasil dikirim!`);
  } catch (error) {
    console.error('Error mengirim laporan:', error.message);
  }
}

// 5. HANDLER PERINTAH DARI TELEGRAM dengan error handling

// Handler /laporan_sekarang
bot.onText(/\/laporan_sekarang/, async (msg) => {
  try {
    const chatId = msg.chat.id;
    if (String(chatId) !== groupChatId && !msg.chat.is_forum) return;
    
    await bot.sendMessage(chatId, '🔄 Mengambil data GA4 terbaru...', {
      ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
    });
    
    await kirimLaporanOtomatis();
  } catch (error) {
    console.error('Error di /laporan_sekarang:', error.message);
  }
});

// Handler /debug_ga4
bot.onText(/\/debug_ga4/, async (msg) => {
  try {
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
  } catch (error) {
    console.error('Error di /debug_ga4:', error.message);
  }
});

// Handler /daftar - DIPERBAIKI: parsing argumen dengan tanda kutip
bot.onText(/\/daftar (.+)/, async (msg, match) => {
  try {
    const chatId = msg.chat.id;
    const adminId = msg.from.id;
    const fullArgs = match[1];

    // Cek apakah perintah berasal dari grup yang benar
    if (String(chatId) !== groupChatId) {
      return bot.sendMessage(chatId, 'Perintah ini hanya dapat digunakan di grup EatSleepPush.');
    }

    // Cek apakah pengirim adalah admin
    const adminIds = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => id.trim()) : [];
    if (!adminIds.includes(adminId.toString())) {
      return bot.sendMessage(chatId, '❌ Hanya admin yang dapat menggunakan perintah ini.', {
        ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
      });
    }

    // Parsing argumen dengan support untuk quoted strings
    const args = [];
    let currentArg = '';
    let inQuotes = false;
    
    for (let i = 0; i < fullArgs.length; i++) {
      const char = fullArgs[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ' ' && !inQuotes) {
        if (currentArg) {
          args.push(currentArg);
          currentArg = '';
        }
      } else {
        currentArg += char;
      }
    }
    
    if (currentArg) {
      args.push(currentArg);
    }

    // Validasi jumlah argumen
    if (args.length < 4) {
      return bot.sendMessage(chatId, '❌ Format salah! Gunakan: /daftar id_telegram "Nama User" "Link" "Artikel"', {
        ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
      });
    }

    const telegramId = args[0];
    const userName = args[1];
    const link = args[2];
    const artikel = args.slice(3).join(' '); // Gabungkan sisa argumen untuk artikel

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
    console.error('Error di /daftar:', error.message);
  }
});

// Handler /userid
bot.onText(/\/userid/, async (msg) => {
  try {
    const chatId = msg.chat.id;
    
    // Cek apakah perintah berasal dari grup yang benar
    if (String(chatId) !== groupChatId) {
      return bot.sendMessage(chatId, 'Perintah ini hanya dapat digunakan di grup EatSleepPush.');
    }

    const userId = msg.from.id;
    const userName = msg.from.first_name || 'User';
    
    await bot.sendMessage(chatId, `👤 *ID Telegram Anda:*\n${userId}\n\n*Nama:* ${userName}\n\nSalin ID ini untuk pendaftaran.`, {
      parse_mode: 'Markdown',
      ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
    });
  } catch (error) {
    console.error('Error di /userid:', error.message);
  }
});

// Handler /lihat_user
bot.onText(/\/lihat_user/, async (msg) => {
  try {
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
  } catch (error) {
    console.error('Error di /lihat_user:', error.message);
  }
});

// Handler /hapus_user
bot.onText(/\/hapus_user (.+)/, async (msg, match) => {
  try {
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
  } catch (error) {
    console.error('Error di /hapus_user:', error.message);
  }
});

// Handler /cekvar
bot.onText(/\/cekvar/, async (msg) => {
  const chatId = msg.chat.id;
  const userName = msg.from.first_name || 'Sahabat';

  // Cek apakah perintah berasal dari grup yang benar
  if (String(chatId) !== groupChatId) {
    return bot.sendMessage(chatId, 'Perintah ini hanya dapat digunakan di grup EatSleepPush.');
  }

  let processingMsg;
  try {
    // Kirim pesan "sedang memproses"
    processingMsg = await bot.sendMessage(chatId, `Halo ${userName}... 🔍 Sedang mengambil data realtime dari GA4...`);

    if (!analyticsDataClient) {
      throw new Error('GA4 Client belum diinisialisasi');
    }

    // Ambil data real-time
    const [realtimeResponse] = await analyticsDataClient.runReport({
      property: `properties/${ga4PropertyId}`,
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

    // Format pesan laporan
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

      // Ringkasan statistik
      const totalActiveUsers = realtimeResponse.rows.reduce((sum, row) => sum + parseInt(row.metricValues[0].value), 0);
      const totalViews = realtimeResponse.rows.reduce((sum, row) => sum + parseInt(row.metricValues[1].value), 0);
      
      reportMessage += `📊 *RINGKASAN:*\n`;
      reportMessage += `   • Total User Aktif (30m): ${totalActiveUsers.toLocaleString('id-ID')}\n`;
      reportMessage += `   • Total Views (30m): ${totalViews.toLocaleString('id-ID')}\n`;

    } else {
      reportMessage += `❌ *Tidak ada data aktif* dalam 30 menit terakhir.\n`;
      reportMessage += `Coba lagi nanti atau periksa koneksi GA4.`;
    }

    // Edit pesan dengan hasil laporan
    await bot.editMessageText(reportMessage, {
      chat_id: chatId,
      message_id: processingMsg.message_id,
      parse_mode: 'Markdown'
    });

  } catch (error) {
    console.error('Error dalam perintah /cekvar:', error.message);
    
    // Kirim pesan error yang aman
    const errorMessage = `❌ *Gagal mengambil data realtime.*\n\nSilakan coba lagi nanti.`;
    
    if (processingMsg) {
      try {
        await bot.editMessageText(errorMessage, {
          chat_id: chatId,
          message_id: processingMsg.message_id,
          parse_mode: 'Markdown'
        });
      } catch {
        // Jika edit gagal, coba kirim pesan baru
        await bot.sendMessage(chatId, errorMessage, { parse_mode: 'Markdown' });
      }
    } else {
      await bot.sendMessage(chatId, errorMessage, { parse_mode: 'Markdown' });
    }
  }
});

// 6. Handler untuk new chat members
bot.on('new_chat_members', async (msg) => {
  try {
    const chatId = msg.chat.id;
    
    // Cek apakah event berasal dari grup yang benar
    if (String(chatId) !== groupChatId) return;

    for (const member of msg.new_chat_members) {
      // Jangan respon jika bot sendiri yang join
      if (member.id === bot.getMe().then(me => me.id)) continue;

      const userId = member.id;
      const userName = member.first_name || 'User';
      
      // Kirim ID user ke grup untuk admin
      const adminMessage = `👤 *User Baru Bergabung*\n\n` +
        `Nama: ${userName}\n` +
        `ID: ${userId}\n\n` +
        `Untuk mendaftarkan user ini, gunakan perintah:\n` +
        `/daftar ${userId} "Nama User" "Link" "Artikel"`;
      
      await bot.sendMessage(chatId, adminMessage, {
        parse_mode: 'Markdown',
        ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
      });
    }
  } catch (error) {
    console.error('Error di new_chat_members handler:', error.message);
  }
});

// 7. Middleware Express
app.use(express.json());

// Endpoint webhook
app.post('/telegram-webhook', (req, res) => {
  try {
    bot.processUpdate(req.body);
    res.sendStatus(200);
  } catch (error) {
    console.error('Error processing webhook update:', error.message);
    res.sendStatus(200);
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    userCount: userDatabase.size 
  });
});

// 8. JALANKAN SERVER
const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`🤖 Server bot berjalan di port ${PORT}`);
  
  // Verifikasi variabel environment yang penting
  if (!token) {
    console.error('❌ TELEGRAM_BOT_TOKEN tidak ditemukan di environment variables');
    return;
  }
  
  if (!groupChatId) {
    console.error('❌ TELEGRAM_GROUP_CHAT_ID tidak ditemukan di environment variables');
    return;
  }

  if (!ga4PropertyId) {
    console.error('❌ GA4_PROPERTY_ID tidak ditemukan di environment variables');
  }

  // Setel webhook
  const webhookUrl = process.env.RAILWAY_STATIC_URL || process.env.RENDER_EXTERNAL_URL;
  
  if (!webhookUrl) {
    console.error('❌ RAILWAY_STATIC_URL atau RENDER_EXTERNAL_URL tidak ditemukan');
    return;
  }

  // Pastikan URL diawali dengan https://
  const fullWebhookUrl = webhookUrl.startsWith('http') 
    ? `${webhookUrl}/telegram-webhook`
    : `https://${webhookUrl}/telegram-webhook`;
  
  try {
    await bot.setWebHook(fullWebhookUrl, {
      max_connections: 40,
      allowed_updates: ['message', 'chat_member']
    });
    
    console.log(`✅ Webhook berhasil disetel ke: ${fullWebhookUrl}`);
    
    // Verifikasi webhook
    const webhookInfo = await bot.getWebHookInfo();
    console.log(`ℹ️  Webhook info: ${webhookInfo.url ? 'Aktif' : 'Tidak aktif'}, pending updates: ${webhookInfo.pending_update_count}`);
    
    // Kirim pesan startup (dengan error handling)
    try {
      await bot.sendMessage(groupChatId, 
        '✅ *Bot Laporan GA4 telah aktif!*\n\n' +
        '*Perintah User:*\n' +
        '• /userid - Lihat ID Telegram Anda\n' +
        '• /cekvar - Laporan realtime 30 menit\n\n' +
        '*Perintah Admin:*\n' +
        '• /daftar id "Nama" "Link" "Artikel"\n' +
        '• /lihat_user - Lihat user terdaftar\n' +
        '• /hapus_user id - Hapus user\n' +
        '• /laporan_sekarang - Kirim laporan manual\n' +
        '• /debug_ga4 - Test koneksi GA4',
        {
          parse_mode: 'Markdown',
          ...(laporanThreadId && { message_thread_id: parseInt(laporanThreadId) })
        }
      );
      console.log('✅ Pesan startup berhasil dikirim ke grup');
    } catch (startupError) {
      console.error('❌ Gagal mengirim pesan startup:', startupError.message);
    }
    
  } catch (error) {
    console.error('❌ Gagal menyetel webhook:', error.message);
  }
});

// 9. Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Menerima SIGTERM, melakukan cleanup...');
  
  try {
    await bot.deleteWebHook();
    console.log('✅ Webhook berhasil dihapus');
  } catch (error) {
    console.error('❌ Gagal menghapus webhook:', error.message);
  }
  
  process.exit(0);
});
