// commands/user-commands.js - UPDATE DENGAN ACCESS CONTROL
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
    const threadId = msg.message_thread_id;
    
    // Cek apakah user boleh kirim di thread ini
    if (!accessControl.canUserSendInThread(threadId, false)) {
      return bot.sendMessage(chatId, 
        '❌ Perintah ini tidak bisa digunakan di topik ini.\n' +
        '📌 Silakan gunakan di topik: #DISKUSI-UMUM, #APLIKASI, atau #TUTORIAL.',
        { parse_mode: 'HTML' }
      );
    }

    const userId = msg.from.id;
    const userName = escapeHtml(msg.from.first_name || 'User');
    const username = msg.from.username ? `(@${msg.from.username})` : '';
    
    const message = `
👤 <b>ID Telegram Anda</b>

<b>User ID:</b> <code>${userId}</code>
<b>Nama:</b> ${userName} ${username}

<i>Salin ID di atas untuk pendaftaran oleh admin.</i>`;
    
    bot.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      message_thread_id: threadId
    });
    
  } catch (error) {
    console.error('❌ Error in /userid:', error.message);
  }
}

/**
 * Handler untuk /cekvar dengan access control & rate limiting
 */
async function handleCekvar(bot, msg, analyticsDataClient) {
  const chatId = msg.chat.id;
  const threadId = msg.message_thread_id;
  const userId = msg.from.id.toString();
  const userName = escapeHtml(msg.from.first_name || 'Sahabat');

  // 1. CEK APAKAH DI THREAD YANG BENAR (LAPORAN = 3)
  const laporanThreadId = parseInt(process.env.LAPORAN_THREAD_ID || 3);
  
  if (threadId !== laporanThreadId) {
    // Kirim instruksi untuk pindah ke thread LAPORAN
    const errorMessage = `
❌ <b>Perintah /cekvar hanya bisa digunakan di topik #LAPORAN</b>

📌 <b>Silakan ketik /cekvar di:</b>
#LAPORAN (Thread ID: ${laporanThreadId})

🔒 <i>Topik akses user:</i>
✅ #DISKUSI-UMUM (ID: 1)
✅ #APLIKASI (ID: 7) 
✅ #TUTORIAL (ID: 5)

🚫 <i>Topik khusus bot:</i>
📊 #LAPORAN (ID: 3) - hanya untuk laporan
📢 #PENGUMUMAN (ID: 9) - hanya pengumuman
`;
    
    return bot.sendMessage(chatId, errorMessage, {
      parse_mode: 'HTML',
      message_thread_id: threadId
    });
  }

  // 2. CEK RATE LIMIT
  const rateLimitCheck = accessControl.checkRateLimit(userId);
  if (!rateLimitCheck.allowed) {
    return bot.sendMessage(chatId, 
      `⏳ <b>Rate Limit Terdeteksi</b>\n\n${rateLimitCheck.message}`,
      {
        parse_mode: 'HTML',
        message_thread_id: threadId
      }
    );
  }

  let processingMsg = null;
  
  try {
    // Kirim pesan "sedang memproses"
    processingMsg = await bot.sendMessage(
      chatId, 
      `Halo ${userName}... 🔍 Sedang mengambil data artikel Anda dari GA4...\n` +
      `⏳ Cooldown: ${rateLimitCheck.cooldown} menit | ` +
      `Sisa request: ${rateLimitCheck.requestsLeft}/${process.env.MAX_REQUESTS_PER_HOUR || 10}`,
      {
        parse_mode: 'HTML',
        message_thread_id: threadId
      }
    );

    // Validasi GA4 client
    if (!analyticsDataClient) {
      throw new Error('GA4 Client belum diinisialisasi');
    }

    // 3. CEK APAKAH USER TERDAFTAR
    const userData = getUser(userId);
    
    if (!userData) {
      throw new Error(
        '❌ Anda belum terdaftar dalam sistem.\n\n' +
        'Silakan minta admin untuk mendaftarkan Anda dengan perintah:\n' +
        `<code>/daftar ${userId} "Nama Anda" "Shortlink" "URL Artikel"</code>`
      );
    }

    // 4. PREPARE USER DATA DENGAN TELEGRAM ID
    const userDataWithId = {
      ...userData,
      id: userId
    };

    console.log(`📊 /cekvar - User: ${userData.nama} (Thread: ${threadId}, Rate: ${rateLimitCheck.requestsLeft} left)`);

    // 5. AMBIL DATA GA4
    const articleData = await fetchUserArticleData(analyticsDataClient, userDataWithId);
    
    // 6. FORMAT LAPORAN
    const reportMessage = formatCustomReport(userDataWithId, articleData);
    
    // 7. TAMBAHKAN RATE LIMIT INFO DI FOOTER
    const fullMessage = reportMessage + 
      `\n\n⏳ <i>Cooldown: ${rateLimitCheck.cooldown} menit | ` +
      `Request tersisa: ${rateLimitCheck.requestsLeft} | ` +
      `Reset dalam: ${rateLimitCheck.resetIn} menit</i>`;
    
    // 8. EDIT PESAN PROSES MENJADI HASIL LAPORAN
    await bot.editMessageText(fullMessage, {
      chat_id: chatId,
      message_id: processingMsg.message_id,
      parse_mode: 'HTML'
    });

    console.log(`✅ /cekvar - Success: ${userData.nama} (Active: ${articleData.activeUsers}, Views: ${articleData.pageViews})`);

  } catch (error) {
    console.error('❌ Error dalam /cekvar:', error.message);
    
    const errorMessage = `
❌ <b>Gagal mengambil data artikel</b>

<code>${escapeHtml(error.message)}</code>

<i>Jika masalah berlanjut, silakan hubungi admin.</i>`;
    
    try {
      if (processingMsg) {
        await bot.editMessageText(errorMessage, {
          chat_id: chatId,
          message_id: processingMsg.message_id,
          parse_mode: 'HTML'
        });
      } else {
        await bot.sendMessage(chatId, errorMessage, {
          parse_mode: 'HTML',
          message_thread_id: threadId
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
    const threadId = msg.message_thread_id;
    const userId = msg.from.id.toString();
    
    // Cek apakah user boleh akses di thread ini
    if (!accessControl.canUserSendInThread(threadId, false)) {
      return;
    }

    const stats = accessControl.getUserStats(userId);
    
    const message = `
📊 <b>Status Rate Limit /cekvar</b>

<b>User ID:</b> <code>${stats.userId}</b>
<b>Terakhir request:</b> ${stats.lastRequestTime}
<b>Request jam ini:</b> ${stats.hourlyCount}/${stats.maxPerHour}
<b>Reset pada:</b> ${stats.hourlyReset}
<b>Cooldown:</b> ${stats.cooldownMinutes} menit

<i>Gunakan /cekvar di topik #LAPORAN (ID: 3)</i>`;
    
    await bot.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      message_thread_id: threadId
    });

  } catch (error) {
    console.error('❌ Error in /cekvar_stats:', error.message);
  }
}

/**
 * Middleware untuk semua commands - cek thread access
 */
function checkThreadAccess(bot, msg, next) {
  const threadId = msg.message_thread_id;
  const command = msg.text?.split(' ')[0];
  
  // Skip untuk bot sendiri atau tanpa thread ID
  if (!threadId || msg.from?.is_bot) {
    return next();
  }
  
  // Cek apakah user boleh kirim di thread ini
  if (!accessControl.canUserSendInThread(threadId, false)) {
    const allowedThreads = [...accessControl.allowedThreads].join(', ');
    
    bot.sendMessage(msg.chat.id,
      `❌ <b>Akses Ditolak</b>\n\n` +
      `Anda tidak bisa mengirim pesan di topik ini.\n\n` +
      `📌 <b>Topik yang diizinkan:</b>\n` +
      `#DISKUSI-UMUM (ID: 1)\n` +
      `#APLIKASI (ID: 7)\n` +
      `#TUTORIAL (ID: 5)\n\n` +
      `🔒 <b>Topik khusus bot:</b>\n` +
      `#LAPORAN (ID: 3) - hanya untuk laporan\n` +
      `#PENGUMUMAN (ID: 9) - hanya pengumuman`,
      {
        parse_mode: 'HTML',
        message_thread_id: threadId
      }
    ).catch(() => {}); // Ignore jika gagal kirim
    
    return; // Stop eksekusi command
  }
  
  next();
}

module.exports = {
  handleUserid,
  handleCekvar,
  handleCekvarStats,
  checkThreadAccess,
  escapeHtml
};
