// commands/user-commands.js - FULL VERSION (FIXED)
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

// Helper untuk mendapatkan nama thread
function getThreadName(threadId) {
  if (!threadId || threadId === 0) return 'Topik Utama';
  
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
 * Handler untuk /userid
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
  const sourceThreadId = msg.message_thread_id || 0;
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

<i>Laporan akan muncul di topik #LAPORAN (ID: ${laporanThreadId})</i>`;
    
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
      `⏳ Tunggu sebentar, laporan akan muncul di topik <b>#LAPORAN</b>`,
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
        `<code>/daftar ${userId} "Nama Anda" "Shortlink" "URL Artikel"</code>`
      );
    }

    // 5. PREPARE USER DATA
    const userDataWithId = {
      ...userData,
      id: userId
    };

    console.log(`📊 /cekvar - User: ${userData.nama} (Source: ${sourceThreadId}, Laporan: ${laporanThreadId})`);

    // 6. AMBIL DATA GA4
    const articleData = await fetchUserArticleData(analyticsDataClient, userDataWithId);
    
    // 7. FORMAT LAPORAN
    const reportMessage = formatCustomReport(userDataWithId, articleData);
    
// 8. EDIT PESAN DI LAPORAN MENJADI HASIL - FORMAT BARU
if (laporanProcessingMsg && laporanProcessingMsg.message_id) {
  // Format waktu sekarang
  const waktuSekarang = new Date().toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).replace(/\./g, ':');
  
  // Format tanggal Indonesia
  const tanggalIndo = new Date().toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  
  const userName = escapeHtml(userData.nama || 'User');
  const userId = userData.id || 'N/A';
  
  // Shortlink: format sebagai teks (bukan link)
  const shortlink = userData.shortlink || '';
  let linkDisplay = 'Tidak ada';
  if (shortlink) {
    linkDisplay = shortlink.replace(/^https?:\/\//, '');
  }
  
  // Artikel: potong jika terlalu panjang
  let articleTitle = userData.articleTitle || 'N/A';
  const maxTitleLength = 40;
  if (articleTitle.length > maxTitleLength) {
    articleTitle = articleTitle.substring(0, maxTitleLength - 3) + '...';
  }
  
  // FORMAT BARU DENGAN FONT KECIL
  const reportMessage = `
<small><b>📈 LAPORAN REALTIME ${waktuSekarang}</b></small>

<small>👤 <b>Nama</b>       : ${userName}</small>
<small>👤 <b>ID Telegram</b> : ${userId}</small>
<small>🔗 <b>Link</b>      : <code>https://${linkDisplay}</code></small>
<small>📄 <b>Artikel</b>   : ${escapeHtml(articleTitle)}</small>
<small>👥 <b>Active User</b> : ${articleData.activeUsers || 0}</small>
<small>👁️ <b>Views</b>      : ${articleData.pageViews || 0}</small>

<small>🕐 <i>Hari ini | ${tanggalIndo}</i></small>`;
  
  await bot.editMessageText(reportMessage, {
    chat_id: chatId,
    message_id: laporanProcessingMsg.message_id,
    parse_mode: 'HTML'
  });
} else {
  // Jika tidak ada message_id, kirim sebagai pesan baru
  await bot.sendMessage(chatId, reportMessage, {
    parse_mode: 'HTML',
    message_thread_id: laporanThreadId
  });
}

    // 9. UPDATE PESAN DI THREAD ASAL (SUKSES) - SIMPLE VERSION
    if (sourceProcessingMsg && sourceProcessingMsg.message_id) {
      await bot.editMessageText(
        `✅ <b>Permintaan /cekvar berhasil diproses!</b>\n\n` +
        `Laporan Anda sudah tersedia di topik <b>#LAPORAN</b>`,
        {
          chat_id: chatId,
          message_id: sourceProcessingMsg.message_id,
          parse_mode: 'HTML'
        }
      );
    } else {
      // Kirim pesan baru jika edit gagal
      await bot.sendMessage(chatId,
        `✅ <b>Permintaan /cekvar berhasil diproses!</b>\n\n` +
        `Laporan Anda sudah tersedia di topik <b>#LAPORAN</b>`,
        {
          parse_mode: 'HTML',
          message_thread_id: sourceThreadId
        }
      );
    }

    console.log(`✅ /cekvar - Success: ${userData.nama}`);

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
      // Coba kirim error ke thread laporan
      await bot.sendMessage(chatId, errorMessage, {
        parse_mode: 'HTML',
        message_thread_id: laporanThreadId
      });
      
      // Juga update di thread asal jika ada processing message
      if (sourceProcessingMsg && sourceProcessingMsg.message_id) {
        try {
          await bot.editMessageText(errorMessage, {
            chat_id: chatId,
            message_id: sourceProcessingMsg.message_id,
            parse_mode: 'HTML'
          });
        } catch (editError) {
          // Jika edit gagal, kirim pesan baru
          await bot.sendMessage(chatId, errorMessage, {
            parse_mode: 'HTML',
            message_thread_id: sourceThreadId
          });
        }
      } else {
        // Kirim error baru ke thread asal
        await bot.sendMessage(chatId, errorMessage, {
          parse_mode: 'HTML',
          message_thread_id: sourceThreadId
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
 * Handler untuk /profil (optional)
 */
async function handleProfil(bot, msg) {
  try {
    const chatId = msg.chat.id;
    const threadId = msg.message_thread_id || 0;
    const userId = msg.from.id.toString();
    const userName = escapeHtml(msg.from.first_name || 'User');
    
    // Cek apakah user boleh akses di thread ini
    if (!accessControl.canUserSendInThread(threadId, false)) {
      return;
    }

    // Ambil data user
    const userData = getUser(userId);
    
    if (!userData) {
      return bot.sendMessage(chatId, 
        `👤 <b>Profil Anda</b>\n\n` +
        `<b>Nama Telegram:</b> ${userName}\n` +
        `<b>ID Telegram:</b> <code>${userId}</code>\n\n` +
        `<i>Status: ❌ Belum terdaftar</i>\n` +
        `<i>Silakan minta admin untuk mendaftarkan Anda.</i>`,
        {
          parse_mode: 'HTML',
          message_thread_id: threadId
        }
      );
    }

    // Format tanggal pendaftaran
    const tanggalDaftar = userData.tanggalDaftar ? 
      new Date(userData.tanggalDaftar).toLocaleDateString('id-ID', {
        timeZone: 'Asia/Jakarta',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }) : 'Tidak diketahui';

    // Tampilkan profil
    const message = `
👤 <b>PROFIL USER</b>

<b>Nama:</b> ${escapeHtml(userData.nama)}
<b>ID Telegram:</b> <code>${userId}</code>
<b>Shortlink:</b> ${userData.shortlink || 'Tidak ada'}
<b>Artikel:</b> ${escapeHtml(userData.articleTitle || 'Tidak ada')}
<b>URL Artikel:</b> ${userData.destinationUrl || 'Tidak ada'}

<b>Tanggal Daftar:</b> ${tanggalDaftar}
<b>Status:</b> ✅ <b>Terdaftar</b>

<i>Gunakan /cekvar di topik manapun, laporan akan muncul di #LAPORAN</i>`;

    await bot.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      message_thread_id: threadId
    });

    console.log(`📋 /profil - ${userData.nama} (ID: ${userId})`);

  } catch (error) {
    console.error('❌ Error in /profil:', error.message);
    try {
      await bot.sendMessage(msg.chat.id, 
        '❌ <b>Error mengambil profil:</b>\n<code>' + escapeHtml(error.message) + '</code>',
        { 
          parse_mode: 'HTML',
          message_thread_id: msg.message_thread_id || 0
        }
      );
    } catch {
      // Ignore jika tidak bisa kirim error
    }
  }
}

/**
 * Handler untuk /bantuan
 */
function handleBantuan(bot, msg) {
  try {
    const chatId = msg.chat.id;
    const threadId = msg.message_thread_id || 0;
    
    const message = `
🤖 <b>BANTUAN - EatSleepPush GA4 Bot</b>

<b>📍 ATURAN TOPIK:</b>
• <b>Topik User:</b> #DISKUSI-UMUM, #APLIKASI, #TUTORIAL
• <b>Topik Bot:</b> #LAPORAN (output laporan), #PENGUMUMAN (pengumuman)

<b>📊 PERINTAH UNTUK USER:</b>
• <code>/userid</code> - Lihat ID Telegram Anda
• <code>/cekvar</code> - Laporan artikel Anda (hanya user terdaftar)
• <code>/profil</code> - Lihat profil Anda
• <code>/cekvar_stats</code> - Lihat status rate limit
• <code>/bantuan</code> - Panduan ini

<b>⚡ RATE LIMIT /cekvar:</b>
• Cooldown: ${process.env.CEKVAR_COOLDOWN_MINUTES || 20} menit
• Maksimal: ${process.env.MAX_REQUESTS_PER_HOUR || 10}x per jam
• Bisa ketik di: Topik User manapun
• Laporan muncul di: <b>#LAPORAN (ID: ${process.env.LAPORAN_THREAD_ID || 3})</b>

<b>👮 PERINTAH ADMIN:</b>
• <code>/daftar id "Nama" "Shortlink" "URL"</code>
• <code>/lihat_user</code> - Lihat semua user
• <code>/hapus_user id</code> - Hapus user
• <code>/reset_rate_limit id</code> - Reset rate limit
• <code>/stats</code> - Statistik sistem

<b>🔗 CARA MENDAFTAR:</b>
1. Ketik <code>/userid</code> untuk melihat ID Telegram
2. Minta admin mendaftarkan dengan:
   <code>/daftar [ID] "[Nama]" "[Shortlink]" "[URL Artikel]"</code>

<i>Bot ini khusus untuk grup EatSleepPush.</i>`;

    bot.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      message_thread_id: threadId
    });

  } catch (error) {
    console.error('❌ Error in /bantuan:', error.message);
  }
}

/**
 * Middleware untuk semua commands - cek thread access
 */
function checkThreadAccess(bot, msg, next) {
  const threadId = msg.message_thread_id || 0;
  const command = msg.text?.split(' ')[0];
  
  // Skip untuk bot sendiri atau tanpa thread ID
  if (!threadId || msg.from?.is_bot) {
    return next();
  }
  
  // Izinkan /cekvar di SEMUA thread user (kecuali thread khusus bot)
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
  handleProfil,
  handleBantuan,
  checkThreadAccess,
  escapeHtml,
  getThreadName
};
