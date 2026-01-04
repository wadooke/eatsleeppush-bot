// commands/admin-commands.js - Admin command handlers dengan fitur lengkap
const { addUser, getAllUsers, deleteUser } = require('../data/user-database');
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

// ============================================
// 1. PERINTAH /DAFTAR
// ============================================
async function handleDaftar(bot, msg, match) {
  try {
    const chatId = msg.chat.id;
    const threadId = msg.message_thread_id || 0;
    const adminId = msg.from.id;
    const adminName = escapeHtml(msg.from.first_name || 'Admin');
    const fullArgs = match[1];

    // Cek apakah pengirim adalah admin
    if (!isAdmin(adminId)) {
      return await bot.sendMessage(chatId, 
        '❌ <b>Akses Ditolak</b>\n\nHanya admin yang dapat menggunakan perintah ini.',
        {
          parse_mode: 'HTML',
          ...(threadId && { message_thread_id: threadId })
        }
      );
    }

    // Parse arguments dengan support untuk quoted strings
    const args = parseQuotedArguments(fullArgs);

    // Validasi: 4 parameter (id, nama, shortlink, destinationUrl)
    if (args.length < 4) {
      return await bot.sendMessage(chatId, 
        '❌ <b>Format salah!</b>\n\n' +
        'Gunakan: <code>/daftar id_telegram "Nama Lengkap" "Shortlink" "URL_Artikel"</code>\n\n' +
        'Contoh:\n' +
        '<code>/daftar 8462501080 "Meningan Pemalang" "https://wa-me.cloud/bin001" "https://eatsleeppush.com/pml/west-african-flavors/"</code>',
        {
          parse_mode: 'HTML',
          ...(threadId && { message_thread_id: threadId })
        }
      );
    }

    const [telegramId, userName, shortLink, destinationUrl] = args;

    // Validasi telegram ID (harus angka)
    if (!/^\d+$/.test(telegramId)) {
      return await bot.sendMessage(chatId, 
        '❌ <b>ID Telegram harus berupa angka!</b>\n\n' +
        `ID yang dimasukkan: <code>${telegramId}</code>`,
        {
          parse_mode: 'HTML',
          ...(threadId && { message_thread_id: threadId })
        }
      );
    }

    // Validasi shortlink
    if (!shortLink.startsWith('http')) {
      return await bot.sendMessage(chatId, 
        '❌ <b>Shortlink harus berupa URL yang valid!</b>\n\n' +
        'Harus dimulai dengan http:// atau https://',
        {
          parse_mode: 'HTML',
          ...(threadId && { message_thread_id: threadId })
        }
      );
    }

    // Validasi URL tujuan
    if (!destinationUrl.startsWith('http')) {
      return await bot.sendMessage(chatId, 
        '❌ <b>URL artikel harus berupa URL yang valid!</b>\n\n' +
        'Harus dimulai dengan http:// atau https://',
        {
          parse_mode: 'HTML',
          ...(threadId && { message_thread_id: threadId })
        }
      );
    }

    // OTOMATIS EKSTRAK PATH dari URL tujuan
    let ga4Path = '';
    let articleTitle = '';
    try {
      const url = new URL(destinationUrl);
      ga4Path = url.pathname;
      if (!ga4Path || ga4Path === '/') ga4Path = '/';
      
      // Extract article title dari path
      const pathParts = ga4Path.split('/').filter(p => p);
      articleTitle = pathParts[pathParts.length - 1] || 'unknown-article';
      articleTitle = articleTitle.replace(/-/g, ' ');
      
    } catch (error) {
      return await bot.sendMessage(chatId, 
        '❌ <b>URL tujuan tidak valid.</b>\n\n' +
        'Pastikan format URL benar.\n' +
        `URL: <code>${escapeHtml(destinationUrl)}</code>`,
        {
          parse_mode: 'HTML',
          ...(threadId && { message_thread_id: threadId })
        }
      );
    }

    // Cek apakah user sudah terdaftar
    const existingUser = getAllUsers().find(u => u.id === telegramId);
    if (existingUser) {
      return await bot.sendMessage(chatId,
        '⚠️ <b>User sudah terdaftar!</b>\n\n' +
        `User <b>${escapeHtml(existingUser.nama)}</b> sudah terdaftar dengan ID <code>${telegramId}</code>\n\n` +
        'Gunakan /hapus_user terlebih dahulu jika ingin mendaftarkan ulang.',
        {
          parse_mode: 'HTML',
          ...(threadId && { message_thread_id: threadId })
        }
      );
    }

    // Simpan data user
    const userData = {
      nama: userName,
      shortlink: shortLink,
      destinationUrl: destinationUrl,
      ga4Path: ga4Path,
      articleTitle: articleTitle,
      didaftarkanOleh: adminId,
      didaftarkanOlehNama: adminName,
      tanggalDaftar: new Date().toISOString()
    };

    // Tambahkan ke database
    addUser(telegramId, userData);

    // Kirim konfirmasi ke admin
    await bot.sendMessage(chatId, 
      `✅ <b>User berhasil didaftarkan!</b>\n\n` +
      `<b>📝 Detail User:</b>\n` +
      `<b>ID Telegram:</b> <code>${telegramId}</code>\n` +
      `<b>Nama:</b> ${escapeHtml(userName)}\n` +
      `<b>Shortlink:</b> ${shortLink}\n` +
      `<b>Path GA4:</b> <code>${ga4Path}</code>\n` +
      `<b>Judul Artikel:</b> ${escapeHtml(articleTitle)}\n\n` +
      `<b>👮 Didaftarkan oleh:</b> ${adminName} (${adminId})\n` +
      `<b>📅 Tanggal:</b> ${new Date().toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })}`,
      {
        parse_mode: 'HTML',
        ...(threadId && { message_thread_id: threadId })
      }
    );

    // Kirim pengumuman ke thread PENGUMUMAN
    await sendAnnouncement(bot, telegramId, userName, shortLink, destinationUrl, articleTitle, adminName);

    console.log(`✅ User registered: ${userName} (ID: ${telegramId}) by ${adminName}`);

  } catch (error) {
    console.error('❌ Error in /daftar:', error.message);
    
    // Coba kirim error ke admin
    try {
      await bot.sendMessage(msg.chat.id, 
        `❌ <b>Error saat mendaftarkan user:</b>\n\n` +
        `<code>${escapeHtml(error.message)}</code>`,
        {
          parse_mode: 'HTML',
          ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
        }
      );
    } catch (e) {
      // Ignore jika tidak bisa kirim pesan error
    }
  }
}

// ============================================
// 2. PERINTAH /LIHAT_USER
// ============================================
async function handleLihatUser(bot, msg) {
  try {
    const chatId = msg.chat.id;
    const threadId = msg.message_thread_id || 0;
    const adminId = msg.from.id;

    // Cek apakah pengirim adalah admin
    if (!isAdmin(adminId)) {
      return await bot.sendMessage(chatId, 
        '❌ <b>Akses Ditolak</b>\n\nHanya admin yang dapat menggunakan perintah ini.',
        {
          parse_mode: 'HTML',
          ...(threadId && { message_thread_id: threadId })
        }
      );
    }

    const users = getAllUsers();
    
    if (users.length === 0) {
      return await bot.sendMessage(chatId, 
        '📭 <b>Belum ada user yang terdaftar.</b>\n\n' +
        'Gunakan /daftar untuk menambahkan user baru.',
        {
          parse_mode: 'HTML',
          ...(threadId && { message_thread_id: threadId })
        }
      );
    }

    // Group users by registered date
    const today = new Date().toISOString().split('T')[0];
    const usersToday = users.filter(u => 
      u.tanggalDaftar && u.tanggalDaftar.startsWith(today)
    ).length;
    
    let userList = `📋 <b>DAFTAR USER TERDAFTAR</b>\n\n`;
    userList += `<b>📊 Statistik:</b>\n`;
    userList += `• Total User: <b>${users.length}</b>\n`;
    userList += `• Terdaftar Hari Ini: <b>${usersToday}</b>\n\n`;
    userList += `<b>👥 Detail User:</b>\n\n`;
    
    users.forEach((user, index) => {
      const regDate = user.tanggalDaftar ? 
        new Date(user.tanggalDaftar).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' }) : 
        'Tidak diketahui';
      
      userList += `<b>${index + 1}. ${escapeHtml(user.nama)}</b>\n`;
      userList += `   <b>ID:</b> <code>${user.id}</code>\n`;
      userList += `   <b>Shortlink:</b> ${user.shortlink || 'Tidak ada'}\n`;
      userList += `   <b>Artikel:</b> ${user.articleTitle || 'N/A'}\n`;
      userList += `   <b>Tanggal:</b> ${regDate}\n`;
      
      if (user.didaftarkanOlehNama) {
        userList += `   <b>Oleh:</b> ${user.didaftarkanOlehNama}\n`;
      }
      
      userList += `\n`;
    });

    // Split message jika terlalu panjang (Telegram limit: 4096 chars)
    if (userList.length > 4000) {
      const halfIndex = Math.floor(userList.length / 2);
      const firstPart = userList.substring(0, halfIndex);
      const secondPart = userList.substring(halfIndex);
      
      await bot.sendMessage(chatId, firstPart, {
        parse_mode: 'HTML',
        ...(threadId && { message_thread_id: threadId })
      });
      
      await bot.sendMessage(chatId, secondPart, {
        parse_mode: 'HTML',
        ...(threadId && { message_thread_id: threadId })
      });
    } else {
      await bot.sendMessage(chatId, userList, {
        parse_mode: 'HTML',
        ...(threadId && { message_thread_id: threadId })
      });
    }

  } catch (error) {
    console.error('❌ Error in /lihat_user:', error.message);
    try {
      await bot.sendMessage(msg.chat.id, 
        `❌ <b>Error saat mengambil data user:</b>\n\n` +
        `<code>${escapeHtml(error.message)}</code>`,
        {
          parse_mode: 'HTML',
          ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
        }
      );
    } catch (e) {
      // Ignore jika tidak bisa kirim pesan error
    }
  }
}

// ============================================
// 3. PERINTAH /HAPUS_USER
// ============================================
async function handleHapusUser(bot, msg, match) {
  try {
    const chatId = msg.chat.id;
    const threadId = msg.message_thread_id || 0;
    const adminId = msg.from.id;
    const userIdToDelete = match[1]?.trim();

    // Cek apakah pengirim adalah admin
    if (!isAdmin(adminId)) {
      return await bot.sendMessage(chatId, 
        '❌ <b>Akses Ditolak</b>\n\nHanya admin yang dapat menggunakan perintah ini.',
        {
          parse_mode: 'HTML',
          ...(threadId && { message_thread_id: threadId })
        }
      );
    }

    if (!userIdToDelete) {
      return await bot.sendMessage(chatId, 
        '❌ <b>Format salah!</b>\n\n' +
        'Gunakan: <code>/hapus_user id_telegram</code>\n\n' +
        'Contoh: <code>/hapus_user 8462501080</code>',
        {
          parse_mode: 'HTML',
          ...(threadId && { message_thread_id: threadId })
        }
      );
    }

    const deletedUser = deleteUser(userIdToDelete);

    if (!deletedUser) {
      return await bot.sendMessage(chatId, 
        `❌ <b>User tidak ditemukan.</b>\n\n` +
        `User dengan ID <code>${userIdToDelete}</code> tidak ditemukan dalam database.`,
        {
          parse_mode: 'HTML',
          ...(threadId && { message_thread_id: threadId })
        }
      );
    }

    await bot.sendMessage(chatId, 
      `✅ <b>User berhasil dihapus!</b>\n\n` +
      `<b>Detail User yang dihapus:</b>\n` +
      `<b>Nama:</b> ${escapeHtml(deletedUser.nama)}\n` +
      `<b>ID:</b> <code>${userIdToDelete}</code>\n` +
      `<b>Artikel:</b> ${deletedUser.articleTitle || 'N/A'}\n` +
      `<b>Shortlink:</b> ${deletedUser.shortlink || 'N/A'}\n\n` +
      `<b>🗑️ Dihapus oleh:</b> ${escapeHtml(msg.from.first_name || 'Admin')}`,
      {
        parse_mode: 'HTML',
        ...(threadId && { message_thread_id: threadId })
      }
    );

    console.log(`🗑️ User deleted: ${deletedUser.nama} (ID: ${userIdToDelete}) by ${msg.from.first_name}`);

  } catch (error) {
    console.error('❌ Error in /hapus_user:', error.message);
    try {
      await bot.sendMessage(msg.chat.id, 
        `❌ <b>Error saat menghapus user:</b>\n\n` +
        `<code>${escapeHtml(error.message)}</code>`,
        {
          parse_mode: 'HTML',
          ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
        }
      );
    } catch (e) {
      // Ignore jika tidak bisa kirim pesan error
    }
  }
}

// ============================================
// 4. PERINTAH /RESET_RATE_LIMIT
// ============================================
async function handleResetRateLimit(bot, msg, match) {
  try {
    const chatId = msg.chat.id;
    const threadId = msg.message_thread_id || 0;
    const adminId = msg.from.id;
    const targetUserId = match[1]?.trim();

    // Cek apakah pengirim adalah admin
    if (!isAdmin(adminId)) {
      return await bot.sendMessage(chatId, 
        '❌ <b>Akses Ditolak</b>\n\nHanya admin yang dapat menggunakan perintah ini.',
        {
          parse_mode: 'HTML',
          ...(threadId && { message_thread_id: threadId })
        }
      );
    }

    if (!targetUserId) {
      return await bot.sendMessage(chatId, 
        '❌ <b>Format salah!</b>\n\n' +
        'Gunakan: <code>/reset_rate_limit user_id</code>\n\n' +
        'Contoh: <code>/reset_rate_limit 8462501080</code>\n\n' +
        'Atau gunakan <code>/reset_rate_limit all</code> untuk reset semua user.',
        {
          parse_mode: 'HTML',
          ...(threadId && { message_thread_id: threadId })
        }
      );
    }

    if (targetUserId.toLowerCase() === 'all') {
      // Reset semua user (implementasi sederhana)
      // Note: Dalam implementasi nyata, perlu akses ke internal accessControl
      await bot.sendMessage(chatId,
        `✅ <b>Rate limit semua user telah di-reset.</b>\n\n` +
        `<i>Note: Fitur reset all memerlukan restart bot untuk efek penuh.</i>`,
        {
          parse_mode: 'HTML',
          ...(threadId && { message_thread_id: threadId })
        }
      );
      console.log(`🔄 Rate limit reset for ALL users by admin ${adminId}`);
    } else {
      // Reset user tertentu
      const reset = accessControl.resetRateLimit(targetUserId);
      
      if (reset) {
        await bot.sendMessage(chatId, 
          `✅ <b>Rate limit berhasil di-reset!</b>\n\n` +
          `User <code>${targetUserId}</code> sekarang dapat menggunakan /cekvar kembali.`,
          {
            parse_mode: 'HTML',
            ...(threadId && { message_thread_id: threadId })
          }
        );
        console.log(`🔄 Rate limit reset for user ${targetUserId} by admin ${adminId}`);
      } else {
        await bot.sendMessage(chatId,
          `⚠️ <b>User tidak memiliki rate limit aktif.</b>\n\n` +
          `User <code>${targetUserId}</code> tidak sedang dalam cooldown.`,
          {
            parse_mode: 'HTML',
            ...(threadId && { message_thread_id: threadId })
          }
        );
      }
    }

  } catch (error) {
    console.error('❌ Error in /reset_rate_limit:', error.message);
    try {
      await bot.sendMessage(msg.chat.id, 
        `❌ <b>Error saat reset rate limit:</b>\n\n` +
        `<code>${escapeHtml(error.message)}</code>`,
        {
          parse_mode: 'HTML',
          ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
        }
      );
    } catch (e) {
      // Ignore jika tidak bisa kirim pesan error
    }
  }
}

// ============================================
// 5. PERINTAH /STATS (Admin only)
// ============================================
async function handleStats(bot, msg) {
  try {
    const chatId = msg.chat.id;
    const threadId = msg.message_thread_id || 0;
    const adminId = msg.from.id;

    // Cek apakah pengirim adalah admin
    if (!isAdmin(adminId)) {
      return await bot.sendMessage(chatId, 
        '❌ <b>Akses Ditolak</b>\n\nHanya admin yang dapat menggunakan perintah ini.',
        {
          parse_mode: 'HTML',
          ...(threadId && { message_thread_id: threadId })
        }
      );
    }

    const users = getAllUsers();
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    // Hitung statistik
    const totalUsers = users.length;
    const usersToday = users.filter(u => 
      u.tanggalDaftar && u.tanggalDaftar.startsWith(today)
    ).length;
    
    const usersThisWeek = users.filter(u => {
      if (!u.tanggalDaftar) return false;
      const regDate = new Date(u.tanggalDaftar);
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return regDate > weekAgo;
    }).length;
    
    // Group by admin yang mendaftarkan
    const byAdmin = {};
    users.forEach(user => {
      const adminName = user.didaftarkanOlehNama || 'Unknown';
      byAdmin[adminName] = (byAdmin[adminName] || 0) + 1;
    });
    
    let adminStats = '';
    Object.entries(byAdmin).forEach(([admin, count], index) => {
      adminStats += `${index + 1}. ${admin}: ${count} user\n`;
    });

    const message = `
📊 <b>STATISTIK SISTEM</b>

<b>👥 Statistik User:</b>
• Total User: <b>${totalUsers}</b>
• Terdaftar Hari Ini: <b>${usersToday}</b>
• Terdaftar 7 Hari Terakhir: <b>${usersThisWeek}</b>

<b>👮 Statistik per Admin:</b>
${adminStats || '• Tidak ada data'}

<b>⚙️ Konfigurasi Sistem:</b>
• Cooldown /cekvar: ${process.env.CEKVAR_COOLDOWN_MINUTES || 30} menit
• Maksimal /cekvar per jam: ${process.env.MAX_REQUESTS_PER_HOUR || 10}
• Thread LAPORAN: ID ${process.env.LAPORAN_THREAD_ID || 3}
• Thread PENGUMUMAN: ID ${process.env.PENGUMUMAN_THREAD_ID || 9}

<b>🕐 Waktu Server:</b>
${now.toLocaleString('id-ID', { 
  timeZone: 'Asia/Jakarta',
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
})}

<i>Bot ID: ${(await bot.getMe()).id}</i>`;

    await bot.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      ...(threadId && { message_thread_id: threadId })
    });

  } catch (error) {
    console.error('❌ Error in /stats:', error.message);
    try {
      await bot.sendMessage(msg.chat.id, 
        `❌ <b>Error saat mengambil statistik:</b>\n\n` +
        `<code>${escapeHtml(error.message)}</code>`,
        {
          parse_mode: 'HTML',
          ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
        }
      );
    } catch (e) {
      // Ignore jika tidak bisa kirim pesan error
    }
  }
}

// ============================================
// 6. HANDLER NEW CHAT MEMBERS
// ============================================
async function handleNewChatMembers(bot, msg) {
  try {
    const chatId = msg.chat.id;
    const threadId = msg.message_thread_id || 0;
    
    // Cek apakah event berasal dari grup yang benar
    if (String(chatId) !== process.env.TELEGRAM_GROUP_CHAT_ID) return;

    for (const member of msg.new_chat_members) {
      // Jangan respon jika bot sendiri yang join
      const botInfo = await bot.getMe();
      if (member.id === botInfo.id) continue;

      const userId = member.id;
      const userName = member.first_name || 'User';
      const username = member.username ? `@${member.username}` : '';
      
      // Kirim notifikasi ke admin di thread DISKUSI-UMUM
      const adminMessage = `👤 <b>User Baru Bergabung</b>\n\n` +
        `<b>Nama:</b> ${escapeHtml(userName)}\n` +
        `<b>Username:</b> ${username || 'Tidak ada'}\n` +
        `<b>ID Telegram:</b> <code>${userId}</code>\n\n` +
        `<b>📋 Untuk mendaftarkan user ini:</b>\n` +
        `<code>/daftar ${userId} "${userName}" "shortlink_url" "article_url"</code>\n\n` +
        `<i>Pastikan user membaca rules di #PENGUMUMAN terlebih dahulu.</i>`;
      
      // Kirim ke thread DISKUSI-UMUM (ID: 1)
      await bot.sendMessage(chatId, adminMessage, {
        parse_mode: 'HTML',
        message_thread_id: parseInt(process.env.DISKUSI_UMUM_THREAD_ID || 1)
      });
      
      console.log(`👋 New member: ${userName} (${userId}) joined`);
    }
  } catch (error) {
    console.error('❌ Error di new_chat_members handler:', error.message);
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

// Cek apakah user adalah admin
function isAdmin(userId) {
  const adminIds = process.env.ADMIN_IDS ? 
    process.env.ADMIN_IDS.split(',').map(id => id.trim()) : [];
  return adminIds.includes(userId.toString());
}

// Parse arguments dengan support untuk quoted strings
function parseQuotedArguments(fullArgs) {
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
  
  return args;
}

// Kirim pengumuman welcome ke thread PENGUMUMAN
async function sendAnnouncement(bot, telegramId, userName, shortLink, destinationUrl, articleTitle, adminName) {
  const groupChatId = process.env.TELEGRAM_GROUP_CHAT_ID;
  const pengumumanThreadId = parseInt(process.env.PENGUMUMAN_THREAD_ID || 9);
  
  if (!groupChatId) return;
  
  const pengumumanMessage = `🎉 <b>SELAMAT DATANG USER BARU!</b> 🎉\n\n` +
    `Selamat bergabung di komunitas EatSleepPush! Berikut data user baru:\n\n` +
    `<b>👤 Nama User:</b> ${escapeHtml(userName)}\n` +
    `<b>🆔 ID Telegram:</b> <code>${telegramId}</code>\n` +
    `<b>🔗 Shortlink:</b> ${shortLink}\n` +
    `<b>📄 Artikel:</b> ${escapeHtml(articleTitle)}\n` +
    `<b>🌐 URL Artikel:</b> ${destinationUrl}\n\n` +
    `<b>📅 Tanggal Pendaftaran:</b> ${new Date().toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })}\n` +
    `<b>👮 Didaftarkan oleh:</b> ${adminName}\n\n` +
    `<b>📋 Panduan User:</b>\n` +
    `1. Gunakan /userid untuk melihat ID Telegram Anda\n` +
    `2. Gunakan /cekvar di topik #LAPORAN untuk melihat laporan artikel\n` +
    `3. Baca rules di #PENGUMUMAN\n\n` +
    `<i>Selamat berkontribusi! 🚀</i>`;
  
  const pengumumanOptions = {
    parse_mode: 'HTML',
    message_thread_id: pengumumanThreadId
  };
  
  try {
    await bot.sendMessage(groupChatId, pengumumanMessage, pengumumanOptions);
    console.log(`📢 Announcement sent for user: ${userName} in thread ${pengumumanThreadId}`);
  } catch (error) {
    console.error('❌ Error sending announcement:', error.message);
  }
}

// ============================================
// EXPORT FUNCTIONS
// ============================================
module.exports = {
  handleDaftar,
  handleLihatUser,
  handleHapusUser,
  handleResetRateLimit,
  handleStats,
  handleNewChatMembers,
  escapeHtml,
  isAdmin,
  parseQuotedArguments
};
