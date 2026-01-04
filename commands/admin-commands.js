// commands/admin-commands.js - UPDATE DENGAN FIX parse_mode
const { addUser, getAllUsers, deleteUser } = require('../data/user-database');

// ============================================
// 1. PERINTAH /DAFTAR - TAMBAH EXTRACT ARTICLE TITLE
// ============================================
async function handleDaftar(bot, msg, match) {
  try {
    const chatId = msg.chat.id;
    const adminId = msg.from.id;
    const fullArgs = match[1];

    // Cek apakah perintah berasal dari grup yang benar
    if (String(chatId) !== process.env.TELEGRAM_GROUP_CHAT_ID) {
      return await bot.sendMessage(chatId, 'Perintah ini hanya dapat digunakan di grup EatSleepPush.');
    }

    // Cek apakah pengirim adalah admin
    if (!isAdmin(adminId)) {
      return await bot.sendMessage(chatId, '❌ Hanya admin yang dapat menggunakan perintah ini.', {
        ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id }),
        parse_mode: 'HTML' // DIUBAH
      });
    }

    // Parse arguments
    const args = parseQuotedArguments(fullArgs);

    // Validasi: 4 parameter
    if (args.length < 4) {
      return await bot.sendMessage(chatId, '❌ Format salah! Gunakan: /daftar id_telegram "Nama" "Shortlink" "URL_Tujuan"', {
        ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id }),
        parse_mode: 'HTML' // DIUBAH
      });
    }

    const [telegramId, userName, shortLink, destinationUrl] = args;

    // Validasi telegram ID
    if (!/^\d+$/.test(telegramId)) {
      return await bot.sendMessage(chatId, '❌ ID Telegram harus berupa angka!', {
        ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id }),
        parse_mode: 'HTML' // DIUBAH
      });
    }

    // Validasi URLs
    if (!shortLink.startsWith('http') || !destinationUrl.startsWith('http')) {
      return await bot.sendMessage(chatId, '❌ Shortlink dan URL tujuan harus dimulai dengan http:// atau https://', {
        ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id }),
        parse_mode: 'HTML' // DIUBAH
      });
    }

    // EKSTRAK PATH DAN TITLE
    let ga4Path = '';
    let articleTitle = '';
    try {
      const url = new URL(destinationUrl);
      ga4Path = url.pathname;
      if (!ga4Path || ga4Path === '/') ga4Path = '/';
      
      // Extract article title from path (contoh: /pml/west-african-flavors-jollof-egusi-suya-guide/)
      const pathParts = ga4Path.split('/').filter(p => p);
      articleTitle = pathParts[pathParts.length - 1] || 'unknown-article';
      articleTitle = articleTitle.replace(/-/g, ' '); // Optional: "west african flavors..."
      
    } catch (error) {
      return await bot.sendMessage(chatId, '❌ URL tujuan tidak valid. Pastikan format URL benar.', {
        ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id }),
        parse_mode: 'HTML' // DIUBAH
      });
    }

    // Simpan data user (format baru)
    const userData = {
      nama: userName,
      shortlink: shortLink,
      destinationUrl: destinationUrl,
      ga4Path: ga4Path,
      articleTitle: articleTitle, // TAMBAHAN BARU
      didaftarkanOleh: adminId
    };

    // Tambahkan ke database
    addUser(telegramId, userData);

    // Kirim konfirmasi ke admin
    await bot.sendMessage(chatId, 
      `✅ <b>User berhasil didaftarkan!</b>\n\n` +
      `<b>ID:</b> <code>${telegramId}</code>\n` +
      `<b>Nama:</b> ${escapeHtml(userName)}\n` +
      `<b>Shortlink:</b> ${shortLink}\n` +
      `<b>Artikel:</b> ${articleTitle}`, 
      {
        ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id }),
        parse_mode: 'HTML' // DIUBAH
      }
    );

    // Kirim pengumuman
    await sendAnnouncement(bot, telegramId, userName, shortLink, destinationUrl, articleTitle);

    console.log(`✅ User registered: ${userName} (ID: ${telegramId})`);

  } catch (error) {
    console.error('Error in /daftar:', error.message);
    try {
      await bot.sendMessage(msg.chat.id, `❌ <b>Error saat mendaftarkan user:</b>\n<code>${escapeHtml(error.message)}</code>`, {
        ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id }),
        parse_mode: 'HTML' // DIUBAH
      });
    } catch (e) {
      // Ignore jika tidak bisa kirim pesan error
    }
  }
}

// ============================================
// 2. PERINTAH /LIHAT_USER - UPDATE parse_mode
// ============================================
async function handleLihatUser(bot, msg) {
  try {
    const chatId = msg.chat.id;
    const adminId = msg.from.id;

    // Cek apakah perintah berasal dari grup yang benar
    if (String(chatId) !== process.env.TELEGRAM_GROUP_CHAT_ID) {
      return await bot.sendMessage(chatId, 'Perintah ini hanya dapat digunakan di grup EatSleepPush.');
    }

    // Cek apakah pengirim adalah admin
    if (!isAdmin(adminId)) {
      return await bot.sendMessage(chatId, '❌ Hanya admin yang dapat menggunakan perintah ini.', {
        ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id }),
        parse_mode: 'HTML' // DIUBAH
      });
    }

    const users = getAllUsers();
    
    if (users.length === 0) {
      return await bot.sendMessage(chatId, '📭 Belum ada user yang terdaftar.', {
        ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id }),
        parse_mode: 'HTML' // DIUBAH
      });
    }

    let userList = `<b>📋 DAFTAR USER TERDAFTAR</b> (${users.length} user)\n\n`;
    
    users.forEach((user, index) => {
      userList += `<b>${index + 1}. ${escapeHtml(user.nama)}</b>\n`;
      userList += `   <b>ID:</b> <code>${user.id}</code>\n`;
      userList += `   <b>Shortlink:</b> ${user.shortlink}\n`;
      userList += `   <b>Artikel:</b> ${user.articleTitle || 'N/A'}\n`;
      userList += `   <b>Tanggal:</b> ${new Date(user.tanggalDaftar).toLocaleDateString('id-ID')}\n\n`;
    });

    await bot.sendMessage(chatId, userList, {
      parse_mode: 'HTML', // DIUBAH
      ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
    });

  } catch (error) {
    console.error('Error in /lihat_user:', error.message);
    try {
      await bot.sendMessage(msg.chat.id, `❌ <b>Error saat mengambil data user:</b>\n<code>${escapeHtml(error.message)}</code>`, {
        ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id }),
        parse_mode: 'HTML' // DIUBAH
      });
    } catch (e) {
      // Ignore jika tidak bisa kirim pesan error
    }
  }
}

// ============================================
// 3. PERINTAH /HAPUS_USER - UPDATE parse_mode
// ============================================
async function handleHapusUser(bot, msg, match) {
  try {
    const chatId = msg.chat.id;
    const adminId = msg.from.id;
    const userIdToDelete = match[1].trim();

    // Cek apakah perintah berasal dari grup yang benar
    if (String(chatId) !== process.env.TELEGRAM_GROUP_CHAT_ID) {
      return await bot.sendMessage(chatId, 'Perintah ini hanya dapat digunakan di grup EatSleepPush.');
    }

    // Cek apakah pengirim adalah admin
    if (!isAdmin(adminId)) {
      return await bot.sendMessage(chatId, '❌ Hanya admin yang dapat menggunakan perintah ini.', {
        ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id }),
        parse_mode: 'HTML' // DIUBAH
      });
    }

    const deletedUser = deleteUser(userIdToDelete);

    if (!deletedUser) {
      return await bot.sendMessage(chatId, '❌ User tidak ditemukan dalam database.', {
        ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id }),
        parse_mode: 'HTML' // DIUBAH
      });
    }

    await bot.sendMessage(chatId, 
      `✅ <b>User berhasil dihapus!</b>\n\n` +
      `<b>Nama:</b> ${escapeHtml(deletedUser.nama)}\n` +
      `<b>ID:</b> <code>${userIdToDelete}</code>`, 
      {
        parse_mode: 'HTML', // DIUBAH
        ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
      }
    );

    console.log(`🗑️ User deleted: ${deletedUser.nama} (ID: ${userIdToDelete})`);

  } catch (error) {
    console.error('Error in /hapus_user:', error.message);
    try {
      await bot.sendMessage(msg.chat.id, `❌ <b>Error saat menghapus user:</b>\n<code>${escapeHtml(error.message)}</code>`, {
        ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id }),
        parse_mode: 'HTML' // DIUBAH
      });
    } catch (e) {
      // Ignore jika tidak bisa kirim pesan error
    }
  }
}

// ============================================
// 4. HANDLER NEW CHAT MEMBERS - UPDATE parse_mode
// ============================================
async function handleNewChatMembers(bot, msg) {
  try {
    const chatId = msg.chat.id;
    
    // Cek apakah event berasal dari grup yang benar
    if (String(chatId) !== process.env.TELEGRAM_GROUP_CHAT_ID) return;

    for (const member of msg.new_chat_members) {
      // Jangan respon jika bot sendiri yang join
      const botInfo = await bot.getMe();
      if (member.id === botInfo.id) continue;

      const userId = member.id;
      const userName = member.first_name || 'User';
      
      // Kirim ID user ke grup untuk admin
      const adminMessage = `<b>👤 User Baru Bergabung</b>\n\n` +
        `<b>Nama:</b> ${escapeHtml(userName)}\n` +
        `<b>ID:</b> <code>${userId}</code>\n\n` +
        `<b>Untuk mendaftarkan user ini, gunakan perintah:</b>\n` +
        `<code>/daftar ${userId} "Nama User" "Shortlink" "URL_Tujuan"</code>`;
      
      await bot.sendMessage(chatId, adminMessage, {
        parse_mode: 'HTML', // DIUBAH
        ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
      });
    }
  } catch (error) {
    console.error('Error di new_chat_members handler:', error.message);
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

// Kirim pengumuman welcome
async function sendAnnouncement(bot, telegramId, userName, shortLink, destinationUrl, articleTitle) {
  const groupChatId = process.env.TELEGRAM_GROUP_CHAT_ID;
  const pengumumanThreadId = process.env.PENGUMUMAN_THREAD_ID;
  
  if (!groupChatId) return;
  
  const pengumumanMessage = `🎉 <b>SELAMAT DATANG</b> 🎉\n\n` +
    `Selamat bergabung di grup kami! Berikut data user baru:\n\n` +
    `<b>👤 Nama User:</b> ${escapeHtml(userName)}\n` +
    `<b>🆔 ID Telegram:</b> <code>${telegramId}</code>\n` +
    `<b>🔗 Shortlink:</b> ${shortLink}\n` +
    `<b>📄 Artikel:</b> ${articleTitle}\n` +
    `<b>🌐 URL Tujuan:</b> ${destinationUrl}\n\n` +
    `<b>Tanggal Pendaftaran:</b> ${new Date().toLocaleDateString('id-ID')}\n` +
    `<b>Didaftarkan oleh:</b> Admin`;
  
  const pengumumanOptions = {
    parse_mode: 'HTML', // DIUBAH
    ...(pengumumanThreadId && { message_thread_id: parseInt(pengumumanThreadId) })
  };
  
  try {
    await bot.sendMessage(groupChatId, pengumumanMessage, pengumumanOptions);
    console.log(`✅ Announcement sent for user: ${userName}`);
  } catch (error) {
    console.error('Error sending announcement:', error.message);
  }
}

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
// EXPORT FUNCTIONS
// ============================================
module.exports = {
  handleDaftar,
  handleLihatUser,
  handleHapusUser,
  handleNewChatMembers
};
