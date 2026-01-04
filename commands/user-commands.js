// commands/user-commands.js - COMPLETE VERSION WITH USER ID PASSING
const { fetchUserArticleData, formatCustomReport } = require('../utils/ga4-reports');
const { getUser } = require('../data/user-database');

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
 * Handler untuk perintah /userid
 * Menampilkan ID Telegram user
 */
function handleUserid(bot, msg) {
  try {
    const chatId = msg.chat.id;
    
    // Cek apakah perintah dari grup yang benar
    if (String(chatId) !== process.env.TELEGRAM_GROUP_CHAT_ID) {
      return bot.sendMessage(chatId, 'Perintah ini hanya dapat digunakan di grup EatSleepPush.', {
        parse_mode: 'HTML'
      });
    }

    const userId = msg.from.id;
    const userName = escapeHtml(msg.from.first_name || 'User');
    const username = msg.from.username ? `(@${msg.from.username})` : '';
    
    // Format pesan dengan HTML
    const message = `
👤 <b>ID Telegram Anda</b>

<b>User ID:</b> <code>${userId}</code>
<b>Nama:</b> ${userName} ${username}
<b>Username:</b> ${msg.from.username ? `@${msg.from.username}` : 'Tidak ada'}

<i>Salin ID di atas untuk pendaftaran oleh admin.</i>`;
    
    bot.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
    });
    
    // Log untuk admin
    console.log(`📋 /userid - ${userName} (ID: ${userId})`);

  } catch (error) {
    console.error('❌ Error in /userid:', error.message);
    // Jangan crash, cukup log error
  }
}

/**
 * Handler untuk perintah /cekvar
 * Menampilkan laporan artikel user dari GA4
 */
async function handleCekvar(bot, msg, analyticsDataClient) {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString(); // Telegram ID as string
  const userName = escapeHtml(msg.from.first_name || 'Sahabat');
  const username = msg.from.username ? `@${msg.from.username}` : '';

  // Cek apakah perintah dari grup yang benar
  if (String(chatId) !== process.env.TELEGRAM_GROUP_CHAT_ID) {
    return bot.sendMessage(chatId, 'Perintah ini hanya dapat digunakan di grup EatSleepPush.', {
      parse_mode: 'HTML'
    });
  }

  let processingMsg = null;
  
  try {
    // Kirim pesan "sedang memproses"
    processingMsg = await bot.sendMessage(
      chatId, 
      `Halo ${userName}... 🔍 Sedang mengambil data artikel Anda dari GA4...\n<i>Mohon tunggu sebentar...</i>`,
      {
        parse_mode: 'HTML',
        ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
      }
    );

    // Validasi GA4 client
    if (!analyticsDataClient) {
      throw new Error('GA4 Client belum diinisialisasi. Silakan coba beberapa saat lagi.');
    }

    // 1. CEK APAKAH USER TERDAFTAR DI DATABASE
    const userData = getUser(userId);
    
    if (!userData) {
      throw new Error(
        '❌ Anda belum terdaftar dalam sistem.\n\n' +
        'Silakan minta admin untuk mendaftarkan Anda dengan perintah:\n' +
        `<code>/daftar ${userId} "Nama Anda" "Shortlink" "URL Artikel"</code>\n\n` +
        'Gunakan /userid untuk melihat ID Telegram Anda.'
      );
    }

    // 2. PREPARE USER DATA DENGAN TELEGRAM ID
    const userDataWithId = {
      ...userData,
      id: userId, // Pastikan ID Telegram ada di data
      telegramName: userName,
      telegramUsername: username
    };

    console.log(`📊 /cekvar - User: ${userData.nama} (Telegram ID: ${userId})`);
    console.log(`   Artikel: ${userData.articleTitle || 'N/A'}`);
    console.log(`   Shortlink: ${userData.shortlink || 'N/A'}`);

    // 3. AMBIL DATA GA4 KHUSUS UNTUK ARTIKEL USER INI
    const articleData = await fetchUserArticleData(analyticsDataClient, userDataWithId);
    
    // 4. FORMAT LAPORAN SESUAI PERMINTAAN
    const reportMessage = formatCustomReport(userDataWithId, articleData);
    
    // 5. EDIT PESAN PROSES MENJADI HASIL LAPORAN
    await bot.editMessageText(reportMessage, {
      chat_id: chatId,
      message_id: processingMsg.message_id,
      parse_mode: 'HTML'
    });

    // Log sukses
    console.log(`✅ /cekvar - Success: ${userData.nama}`);
    console.log(`   Active Users: ${articleData.activeUsers}, Views: ${articleData.pageViews}`);

  } catch (error) {
    console.error('❌ Error dalam /cekvar:', error.message);
    
    // Format error message dengan HTML
    const errorMessage = `
❌ <b>Gagal mengambil data artikel</b>

<code>${escapeHtml(error.message)}</code>

<i>Jika masalah berlanjut, silakan hubungi admin.</i>`;
    
    try {
      if (processingMsg) {
        // Edit pesan processing menjadi error message
        await bot.editMessageText(errorMessage, {
          chat_id: chatId,
          message_id: processingMsg.message_id,
          parse_mode: 'HTML'
        });
      } else {
        // Kirim pesan error baru
        await bot.sendMessage(chatId, errorMessage, {
          parse_mode: 'HTML',
          ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
        });
      }
    } catch (telegramError) {
      // Fallback jika edit message gagal
      console.error('❌ Gagal mengirim error ke Telegram:', telegramError.message);
      try {
        await bot.sendMessage(chatId, errorMessage, {
          parse_mode: 'HTML',
          ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
        });
      } catch (finalError) {
        console.error('❌ Gagal total mengirim error:', finalError.message);
      }
    }
  }
}

/**
 * Handler untuk perintah /profil (optional)
 * Menampilkan profil user
 */
async function handleProfil(bot, msg) {
  try {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    const userName = escapeHtml(msg.from.first_name || 'User');
    
    // Cek apakah perintah dari grup yang benar
    if (String(chatId) !== process.env.TELEGRAM_GROUP_CHAT_ID) {
      return bot.sendMessage(chatId, 'Perintah ini hanya dapat digunakan di grup EatSleepPush.', {
        parse_mode: 'HTML'
      });
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
          ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
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

<i>Gunakan /cekvar untuk melihat laporan artikel Anda.</i>`;

    await bot.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
    });

    console.log(`📋 /profil - ${userData.nama} (ID: ${userId})`);

  } catch (error) {
    console.error('❌ Error in /profil:', error.message);
    try {
      await bot.sendMessage(msg.chat.id, 
        '❌ <b>Error mengambil profil:</b>\n<code>' + escapeHtml(error.message) + '</code>',
        { parse_mode: 'HTML' }
      );
    } catch {
      // Ignore jika tidak bisa kirim error
    }
  }
}

/**
 * Handler untuk perintah /bantuan
 * Menampilkan panduan penggunaan
 */
function handleBantuan(bot, msg) {
  try {
    const chatId = msg.chat.id;
    
    const message = `
🤖 <b>BANTUAN - EatSleepPush GA4 Bot</b>

<b>Perintah untuk User:</b>
• /userid - Lihat ID Telegram Anda
• /cekvar - Laporan artikel Anda (hanya user terdaftar)
• /profil - Lihat profil Anda
• /bantuan - Tampilkan panduan ini

<b>Perintah untuk Admin:</b>
• /daftar id "Nama" "Shortlink" "URL"
• /lihat_user - Lihat semua user terdaftar
• /hapus_user id - Hapus user dari sistem
• /laporan_sekarang - Kirim laporan manual
• /debug_ga4 - Test koneksi GA4

<b>Cara Mendaftar:</b>
1. Ketik /userid untuk melihat ID Telegram
2. Minta admin mendaftarkan dengan:
   <code>/daftar [ID] "[Nama]" "[Shortlink]" "[URL Artikel]"</code>

<i>Bot ini khusus untuk grup EatSleepPush.</i>`;

    bot.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
    });

  } catch (error) {
    console.error('❌ Error in /bantuan:', error.message);
  }
}

// Export semua handlers
module.exports = {
  handleUserid,
  handleCekvar,
  handleProfil,
  handleBantuan
};
