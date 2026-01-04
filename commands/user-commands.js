// commands/user-commands.js - UPDATE UNTUK FEATURE BARU
const { fetchUserArticleData, formatCustomReport } = require('../utils/ga4-reports');
const { getUser } = require('../data/user-database');
const accessControl = require('../utils/access-control');

// Helper function untuk escape HTML
function escapeHtml(text) {
  if (!text) return '';
  return text.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Handler untuk /userid dengan access control
 */
function handleUserid(bot, msg) {
  try {
    const chatId = msg.chat.id;
    const threadId = msg.message_thread_id || 0;
    
    // Cek apakah user boleh kirim di thread ini (bukan thread khusus bot)
    if (!accessControl.canUserSendInThread(threadId, false)) {
      return bot.sendMessage(chatId, 
        '❌ <b>Perintah tidak bisa digunakan di topik ini.</b>\n\n' +
        '📌 <b>Topik yang diizinkan:</b>\n' +
        '✅ #DISKUSI-UMUM (ID: 1)\n' +
        '✅ #APLIKASI (ID: 7)\n' +
        '✅ #TUTORIAL (ID: 5)\n\n' +
        '🔒 <b>Topik khusus bot:</b>\n' +
        '📊 #LAPORAN (ID: 3) - hanya untuk output laporan\n' +
        '📢 #PENGUMUMAN (ID: 9) - hanya pengumuman',
        {
          parse_mode: 'HTML',
          message_thread_id: threadId
        }
      );
    }

    const userId = msg.from.id;
    const userName = escapeHtml(msg.from.first_name || 'User');
    const username = msg.from.username ? `(@${msg.from.username})` : '';
    
    const message = `
👤 <b>ID Telegram Anda</b>

<b>User ID:</b> <code>${userId}</code>
<b>Nama:</b> ${userName} ${username}
<b>Username:</b> ${msg.from.username ? `@${msg.from.username}` : 'Tidak ada'}

<i>Salin ID di atas untuk pendaftaran oleh admin.</i>
<i>Gunakan /cekvar di topik manapun, laporan akan muncul di #LAPORAN</i>`;
    
    bot.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      message_thread_id: threadId
    });
    
    console.log(`📋 /userid - ${userName} (ID: ${userId}) in thread ${threadId}`);

  } catch (error) {
    console.error('❌ Error in /userid:', error.message);
  }
}

/**
 * Handler untuk /cekvar - BISA DI THREAD MANAPUN, OUTPUT DI #LAPORAN
 */
async function handleCekvar(bot, msg, analyticsDataClient) {
  const chatId = msg.chat.id;
  const sourceThreadId = msg.message_thread_id || 0; // Thread asal command
  const userId = msg.from.id.toString();
  const userName = escapeHtml(msg.from.first_name || 'Sahabat');
  
  // Thread tujuan: selalu #LAPORAN (ID: 3)
  const laporanThreadId = parseInt(process.env.LAPORAN_THREAD_ID || 3);

  // 1. CEK RATE LIMIT (20 menit)
  const rateLimitCheck = accessControl.checkRateLimit(userId);
  if (!rateLimitCheck.allowed) {
    const replyMessage = `
⏳ <b>Rate Limit Terdeteksi</b>

${rateLimitCheck.message}

<b>📊 Status Anda:</b>
• User: ${userName}
• ID: <code>${userId}</code>
• Cooldown: ${process.env.CEKVAR_COOLDOWN_MINUTES || 20} menit

<i>Laporan akan selalu muncul di topik #LAPORAN (ID: ${laporanThreadId})</i>`;
    
    return bot.sendMessage(chatId, replyMessage, {
      parse_mode: 'HTML',
      message_thread_id: sourceThreadId
    });
  }

  let sourceProcessingMsg = null;
  let laporanProcessingMsg = null;
  
  try {
    // 2. KIRIM PESAN "SEDANG PROSES" DI THREAD ASAL
    sourceProcessingMsg = await bot.sendMessage(
      chatId, 
      `🔍 <b>Memproses permintaan /cekvar</b>\n\n` +
      `Halo ${userName}, permintaan Anda sedang diproses...\n` +
      `⏳ Tunggu sebentar, laporan akan muncul di topik <b>#LAPORAN</b>\n\n` +
      `<i>Cooldown: ${rateLimitCheck.cooldown} menit | ` +
      `Sisa request: ${rateLimitCheck.requestsLeft}/${process.env.MAX_REQUESTS_PER_HOUR || 10}</i>`,
      {
        parse_mode: 'HTML',
        message_thread_id: sourceThreadId
      }
    );

    // 3. KIRIM PESAN PROSES DI THREAD LAPORAN
    laporanProcessingMsg = await bot.sendMessage(
      chatId,
      `🔄 <b>Memproses laporan untuk:</b> ${userName} (ID: ${userId})\n` +
      `📁 <b>Dari topik:</b> ${getThreadName(sourceThreadId)}\n` +
      `⏳ <b>Status:</b> Mengambil data dari GA4...`,
      {
        parse_mode: 'HTML',
        message_thread_id: laporanThreadId
      }
    );

    // Validasi GA4 client
    if (!analyticsDataClient) {
      throw new Error('GA4 Client belum diinisialisasi');
    }

    // 4. CEK APAKAH USER TERDAFTAR
    const userData = getUser(userId);
    
    if (!userData) {
      throw new Error(
        '❌ <b>Anda belum terdaftar dalam sistem.</b>\n\n' +
        'Silakan minta admin untuk mendaftarkan Anda dengan perintah:\n' +
        `<code>/daftar ${userId} "Nama Anda" "Shortlink" "URL Artikel"</code>\n\n` +
        'Gunakan /userid untuk melihat ID Telegram Anda.'
      );
    }

    // 5. PREPARE USER DATA DENGAN TELEGRAM ID
    const userDataWithId = {
      ...userData,
      id: userId,
      sourceThreadId: sourceThreadId,
      sourceThreadName: getThreadName(sourceThreadId)
    };

    console.log(`📊 /cekvar - User: ${userData.nama} (Source Thread: ${sourceThreadId}, Laporan Thread: ${laporanThreadId})`);

    // 6. AMBIL DATA GA4
    const articleData = await fetchUserArticleData(analyticsDataClient, userDataWithId);
    
    // 7. FORMAT LAPORAN
    const reportMessage = formatCustomReport(userDataWithId, articleData);
    
    // 8. EDIT PESAN PROSES DI LAPORAN MENJADI HASIL
    const fullReportMessage = reportMessage + 
      `\n\n📌 <b>Info Request:</b>\n` +
      `• <b>User:</b> ${userName} (ID: ${userId})\n` +
      `• <b>Dari topik:</b> ${getThreadName(sourceThreadId)} (ID: ${sourceThreadId})\n` +
      `• <b>Waktu request:</b> ${new Date().toLocaleString('id-ID', { 
        timeZone: 'Asia/Jakarta',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }).replace(/\./g, ':')}\n` +
      `• <b>Cooldown:</b> ${rateLimitCheck.cooldown} menit | ` +
      `Request tersisa: ${rateLimitCheck.requestsLeft}`;
    
    await bot.editMessageText(fullReportMessage, {
      chat_id: chatId,
      message_id: laporanProcessingMsg.message_id,
      parse_mode: 'HTML'
    });

    // 9. UPDATE PESAN DI THREAD ASAL (SUKSES)
    await bot.editMessageText(
      `✅ <b>Permintaan /cekvar berhasil diproses!</b>\n\n` +
      `Laporan Anda sudah tersedia di topik <b>#LAPORAN</b>\n\n` +
      `<b>📋 Detail:</b>\n` +
      `• User: ${userName}\n` +
      `• Artikel: ${userData.articleTitle || 'N/A'}\n` +
      `• Active Users: ${articleData.activeUsers || 0}\n` +
      `• Views: ${articleData.pageViews || 0}\n\n` +
      `<i>⏳ Cooldown: ${rateLimitCheck.cooldown} menit | ` +
      `Sisa request: ${rateLimitCheck.requestsLeft}</i>`,
      {
        chat_id: chatId,
        message_id: sourceProcessingMsg.message_id,
        parse_mode: 'HTML'
      }
    );

    console.log(`✅ /cekvar - Success: ${userData.nama} | Source: ${sourceThreadId} → Laporan: ${laporanThreadId}`);

  } catch (error) {
    console.error('❌ Error dalam /cekvar:', error.message);
    
    const errorMessage = `
❌ <b>Gagal mengambil data artikel</b>

<code>${escapeHtml(error.message)}</code>

<b>📌 Info:</b>
• User: ${userName} (ID: ${userId})
• Dari topik: ${getThreadName(sourceThreadId)}
• Thread laporan: #LAPORAN (ID: ${laporanThreadId})

<i>Jika masalah berlanjut, silakan hubungi admin.</i>`;
    
    try {
      // Update pesan error di thread asal
      if (sourceProcessingMsg) {
        await bot.editMessageText(errorMessage, {
          chat_id: chatId,
          message_id: sourceProcessingMsg.message_id,
          parse_mode: 'HTML'
        });
      }
      
      // Juga kirim error ke thread laporan jika ada processing msg
      if (laporanProcessingMsg) {
        await bot.editMessageText(errorMessage, {
          chat_id: chatId,
          message_id: laporanProcessingMsg.message_id,
          parse_mode: 'HTML'
        });
      } else {
        // Kirim error baru ke thread laporan
        await bot.sendMessage(chatId, errorMessage, {
          parse_mode: 'HTML',
          message_thread_id: laporanThreadId
        });
      }
      
    } catch (telegramError) {
      console.error('❌ Gagal mengirim error ke Telegram:', telegramError.message);
    }
  }
}

/**
 * Handler untuk /cekvar_stats (lihat status rate limit)
 */
async function handleCekvarStats(bot, msg) {
  try {
    const chatId = msg.chat.id;
    const threadId = msg.message_thread_id || 0;
    const userId = msg.from.id.toString();
    
    // Cek apakah user boleh akses di thread ini
    if (!accessControl.canUserSendInThread(threadId, false)) {
      return;
    }

    const stats = accessControl.getUserStats(userId);
    const cooldownMinutes = parseInt(process.env.CEKVAR_COOLDOWN_MINUTES || 20);
    
    const message = `
📊 <b>Status Rate Limit /cekvar</b>

<b>👤 User:</b> <code>${stats.userId}</code>
<b>⏳ Terakhir request:</b> ${stats.lastRequestTime}
<b>📊 Request jam ini:</b> ${stats.hourlyCount}/${stats.maxPerHour}
<b>🔄 Reset pada:</b> ${stats.hourlyReset}
<b>⏱️ Cooldown:</b> ${cooldownMinutes} menit

<b>📍 Info Thread:</b>
• Bisa ketik /cekvar di: #DISKUSI-UMUM, #APLIKASI, #TUTORIAL
• Laporan muncul di: <b>#LAPORAN (ID: ${process.env.LAPORAN_THREAD_ID || 3})</b>

<i>Gunakan /bantuan untuk panduan lengkap</i>`;
    
    await bot.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      message_thread_id: threadId
    });

  } catch (error) {
    console.error('❌ Error in /cekvar_stats:', error.message);
  }
}

/**
 * Get thread name dari ID
 */
function getThreadName(threadId) {
  const threads = {
    1: '#DISKUSI-UMUM',
    7: '#APLIKASI', 
    5: '#TUTORIAL',
    3: '#LAPORAN',
    9: '#PENGUMUMAN'
  };
  
  return threads[threadId] || `Thread ID: ${threadId}`;
}

/**
 * Middleware untuk semua commands - cek thread access
 * (Diperbarui untuk mengizinkan /cekvar di semua thread user)
 */
function checkThreadAccess(bot, msg, next) {
  const threadId = msg.message_thread_id || 0;
  const command = msg.text?.split(' ')[0];
  
  // Skip untuk bot sendiri atau tanpa thread ID
  if (!threadId || msg.from?.is_bot) {
    return next();
  }
  
  // Izinkan /cekvar di SEMUA thread (kecuali thread khusus bot)
  if (command === '/cekvar') {
    // Cek apakah di thread khusus bot (LAPORAN, PENGUMUMAN)
    const botOnlyThreads = [
      parseInt(process.env.LAPORAN_THREAD_ID || 3),
      parseInt(process.env.PENGUMUMAN_THREAD_ID || 9)
    ];
    
    if (botOnlyThreads.includes(threadId)) {
      bot.sendMessage(msg.chat.id,
        `❌ <b>/cekvar tidak bisa digunakan di topik ini</b>\n\n` +
        `Topik ini khusus untuk output laporan (#LAPORAN) atau pengumuman (#PENGUMUMAN).\n\n` +
        `<b>📍 Gunakan /cekvar di:</b>\n` +
        `✅ #DISKUSI-UMUM (ID: 1)\n` +
        `✅ #APLIKASI (ID: 7)\n` +
        `✅ #TUTORIAL (ID: 5)\n\n` +
        `<i>Laporan akan tetap muncul di #LAPORAN (ID: ${process.env.LAPORAN_THREAD_ID || 3})</i>`,
        {
          parse_mode: 'HTML',
          message_thread_id: threadId
        }
      ).catch(() => {});
      return;
    }
    
    return next(); // Izinkan /cekvar di thread user
  }
  
  // Untuk command lain, cek normal access
  if (!accessControl.canUserSendInThread(threadId, false)) {
    bot.sendMessage(msg.chat.id,
      `❌ <b>Akses Ditolak</b>\n\n` +
      `Anda tidak bisa mengirim pesan di topik ini.\n\n` +
      `📍 <b>Topik yang diizinkan:</b>\n` +
      `✅ #DISKUSI-UMUM (ID: 1)\n` +
      `✅ #APLIKASI (ID: 7)\n` +
      `✅ #TUTORIAL (ID: 5)\n\n` +
      `🔒 <b>Topik khusus bot:</b>\n` +
      `📊 #LAPORAN (ID: 3) - hanya untuk output laporan\n` +
      `📢 #PENGUMUMAN (ID: 9) - hanya pengumuman`,
      {
        parse_mode: 'HTML',
        message_thread_id: threadId
      }
    ).catch(() => {});
    return;
  }
  
  next();
}

module.exports = {
  handleUserid,
  handleCekvar,
  handleCekvarStats,
  checkThreadAccess,
  escapeHtml,
  getThreadName
};
