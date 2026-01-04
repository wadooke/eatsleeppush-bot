// commands/admin-commands.js - Admin command handlers
const { addUser, getAllUsers, deleteUser, getUser } = require('../data/user-database');

// ============================================
// 1. PERINTAH /DAFTAR
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
        ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
      });
    }

    // Parse arguments dengan support untuk quoted strings
    const args = parseQuotedArguments(fullArgs);

    // Validasi: 4 parameter (id, nama, shortlink, destinationUrl)
    if (args.length < 4) {
      return await bot.sendMessage(chatId, '❌ Format salah! Gunakan: /daftar id_telegram "Nama" "Shortlink" "URL_Tujuan"', {
        ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
      });
    }

    const [telegramId, userName, shortLink, destinationUrl] = args;

    // Validasi telegram ID (harus angka)
    if (!/^\d+$/.test(telegramId)) {
      return await bot.sendMessage(chatId, '❌ ID Telegram harus berupa angka!', {
        ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
      });
    }

    // Validasi shortlink
    if (!shortLink.startsWith('http')) {
      return await bot.sendMessage(chatId, '❌ Shortlink harus dimulai dengan http:// atau https://', {
        ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
      });
    }

    // Validasi URL tujuan
    if (!destinationUrl.startsWith('http')) {
      return await bot.sendMessage(chatId, '❌ URL tujuan harus dimulai dengan http:// atau https://', {
        ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
      });
    }

    // OTOMATIS EKSTRAK PATH dari URL tujuan
    let ga4Path = '';
    try {
      const url = new URL(destinationUrl);
      ga4Path = url.pathname;
      if (!ga4Path || ga4Path === '/') ga4Path = '/';
    } catch (error) {
      return await bot.sendMessage(chatId, '❌ URL tujuan tidak valid. Pastikan format URL benar.', {
        ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
      });
    }

    // Simpan data user
    const userData = {
      nama: userName,
      shortlink: shortLink,
      destinationUrl: destinationUrl,
      ga4Path: ga4Path,
      didaftarkanOleh: adminId
    };

    // Tambahkan ke database
    addUser(telegramId, userData);

    // Kirim konfirmasi ke admin
    await bot.sendMessage(chatId, `✅ User berhasil didaftarkan!\n\nID: ${telegramId}\nNama: ${userName}\nShortlink: ${shortLink}`, {
      ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
    });

    // Kirim pengumuman
    await sendAnnouncement(bot, telegramId, userName, shortLink, destinationUrl);

    console.log(`✅ User registered: ${userName} (ID: ${telegramId})`);

  } catch (error) {
    console.error('Error in /daftar:', error.message);
    // Coba kirim error ke admin
    try {
      await bot.sendMessage(msg.chat.id, `❌ Error saat mendaftarkan user: ${error.message}`, {
        ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
      });
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
    const adminId = msg.from.id;

    // Cek apakah perintah berasal dari grup yang benar
    if (String(chatId) !== process.env.TELEGRAM_GROUP_CHAT_ID) {
      return await bot.sendMessage(chatId, 'Perintah ini hanya dapat digunakan di grup EatSleepPush.');
    }

    // Cek apakah pengirim adalah admin
    if (!isAdmin(adminId)) {
      return await bot.sendMessage(chatId, '❌ Hanya admin yang dapat menggunakan perintah ini.', {
        ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
      });
    }

    const users = getAllUsers();
    
    if (users.length === 0) {
      return await bot.sendMessage(chatId, '📭 Belum ada user yang terdaftar.', {
        ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
      });
    }

    let userList = `📋 *DAFTAR USER TERDAFTAR* (${users.length} user)\n\n`;
    
    users.forEach((user, index) => {
      userList += `${index + 1}. *${user.nama}*\n`;
      userList += `   ID: ${user.id}\n`;
      userList += `   Shortlink: ${user.shortlink}\n`;
      userList += `   URL Tujuan: ${user.destinationUrl}\n`;
      userList += `   Tanggal: ${new Date(user.tanggalDaftar).toLocaleDateString('id-ID')}\n\n`;
    });

    await bot.sendMessage(chatId, userList, {
      parse_mode: 'Markdown',
      ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
    });

  } catch (error) {
    console.error('Error in /lihat_user:', error.message);
    try {
      await bot.sendMessage(msg.chat.id, `❌ Error saat mengambil data user: ${error.message}`, {
        ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
      });
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
    const adminId = msg.from.id;
    const userIdToDelete = match[1].trim();

    // Cek apakah perintah berasal dari grup yang benar
    if (String(chatId) !== process.env.TELEGRAM_GROUP_CHAT_ID) {
      return await bot.sendMessage(chatId, 'Perintah ini hanya dapat digunakan di grup EatSleepPush.');
    }

    // Cek apakah pengirim adalah admin
    if (!isAdmin(adminId)) {
      return await bot.sendMessage(chatId, '❌ Hanya admin yang dapat menggunakan perintah ini.', {
        ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
      });
    }

    const deletedUser = deleteUser(userIdToDelete);

    if (!deletedUser) {
      return await bot.sendMessage(chatId, '❌ User tidak ditemukan dalam database.', {
        ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
      });
    }

    await bot.sendMessage(chatId, `✅ User berhasil dihapus!\n\n*Nama:* ${deletedUser.nama}\n*ID:* ${userIdToDelete}`, {
      parse_mode: 'Markdown',
      ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
    });

    console.log(`🗑️ User deleted: ${deletedUser.nama} (ID: ${userIdToDelete})`);

  } catch (error) {
    console.error('Error in /hapus_user:', error.message);
    try {
      await bot.sendMessage(msg.chat.id, `❌ Error saat menghapus user: ${error.message}`, {
        ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
      });
    } catch (e) {
      // Ignore jika tidak bisa kirim pesan error
    }
  }
}

// ============================================
// 4. HANDLER NEW CHAT MEMBERS
// ============================================
async function handleNewChatMembers(bot, msg) {
  try {
    const chatId = msg.chat.id;
    
    // Cek apakah event berasal dari grup yang benar
    if (String(chatId) !== process.env.TELEGRAM_GROUP_CHAT_ID) return;

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
        `/daftar ${userId} "Nama User" "Shortlink" "URL_Tujuan"`;
      
      await bot.sendMessage(chatId, adminMessage, {
        parse_mode: 'Markdown',
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
async function sendAnnouncement(bot, telegramId, userName, shortLink, destinationUrl) {
  const groupChatId = process.env.TELEGRAM_GROUP_CHAT_ID;
  const pengumumanThreadId = process.env.PENGUMUMAN_THREAD_ID;
  
  if (!groupChatId) return;
  
  const pengumumanMessage = `🎉 *SELAMAT DATANG* 🎉\n\n` +
    `Selamat bergabung di grup kami! Berikut data user baru:\n\n` +
    `👤 *Nama User:* ${userName}\n` +
    `🆔 *ID Telegram:* ${telegramId}\n` +
    `🔗 *Shortlink:* ${shortLink}\n` +
    `🌐 *URL Tujuan:* ${destinationUrl}\n\n` +
    `*Tanggal Pendaftaran:* ${new Date().toLocaleDateString('id-ID')}\n` +
    `*Didaftarkan oleh:* Admin`;
  
  const pengumumanOptions = {
    parse_mode: 'Markdown',
    ...(pengumumanThreadId && { message_thread_id: parseInt(pengumumanThreadId) })
  };
  
  try {
    await bot.sendMessage(groupChatId, pengumumanMessage, pengumumanOptions);
    console.log(`✅ Announcement sent for user: ${userName}`);
  } catch (error) {
    console.error('Error sending announcement:', error.message);
  }
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
