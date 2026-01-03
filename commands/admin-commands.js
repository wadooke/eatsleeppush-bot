// commands/admin-commands.js - Admin command handlers
const { addUser, getAllUsers, deleteUser, getUserCount } = require('../data/user-database');

function handleDaftar(bot, msg, match) {
  try {
    const chatId = msg.chat.id;
    const adminId = msg.from.id;
    const fullArgs = match[1];

    // Check admin permissions
    if (!isAdmin(adminId)) {
      return bot.sendMessage(chatId, '❌ Hanya admin yang dapat menggunakan perintah ini.', {
        ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
      });
    }

    // Parse arguments with quoted string support
    const args = parseQuotedArguments(fullArgs);

    // Validate arguments
    if (args.length < 4) {
      return bot.sendMessage(chatId, '❌ Format salah! Gunakan: /daftar id_telegram "Nama User" "Link" "Artikel"', {
        ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
      });
    }

    const [telegramId, userName, link, ...artikelParts] = args;
    const artikel = artikelParts.join(' ');

    // Validate telegram ID
    if (!/^\d+$/.test(telegramId)) {
      return bot.sendMessage(chatId, '❌ ID Telegram harus berupa angka!', {
        ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
      });
    }

    // Add user to database
    const userData = {
      nama: userName,
      link: link,
      artikel: artikel,
      didaftarkanOleh: adminId
    };

    addUser(telegramId, userData);

    // Send confirmation to admin
    bot.sendMessage(chatId, `✅ User berhasil didaftarkan!\n\nID: ${telegramId}\nNama: ${userName}`, {
      ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
    });

    // Send announcement
    sendAnnouncement(bot, telegramId, userName, link, artikel);

  } catch (error) {
    console.error('Error in /daftar:', error.message);
  }
}

function handleLihatUser(bot, msg) {
  try {
    const chatId = msg.chat.id;
    const adminId = msg.from.id;

    if (!isAdmin(adminId)) {
      return bot.sendMessage(chatId, '❌ Hanya admin yang dapat menggunakan perintah ini.', {
        ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
      });
    }

    const users = getAllUsers();
    
    if (users.length === 0) {
      return bot.sendMessage(chatId, '📭 Belum ada user yang terdaftar.', {
        ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
      });
    }

    let userList = `📋 *DAFTAR USER TERDAFTAR* (${users.length} user)\n\n`;
    
    users.forEach((user, index) => {
      userList += `${index + 1}. *${user.nama}*\n`;
      userList += `   ID: ${user.id}\n`;
      userList += `   Link: ${user.link}\n`;
      userList += `   Artikel: ${user.artikel.substring(0, 50)}${user.artikel.length > 50 ? '...' : ''}\n`;
      userList += `   Tanggal: ${new Date(user.tanggalDaftar).toLocaleDateString('id-ID')}\n\n`;
    });

    bot.sendMessage(chatId, userList, {
      parse_mode: 'Markdown',
      ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
    });

  } catch (error) {
    console.error('Error in /lihat_user:', error.message);
  }
}

function handleHapusUser(bot, msg, match) {
  try {
    const chatId = msg.chat.id;
    const adminId = msg.from.id;
    const userIdToDelete = match[1].trim();

    if (!isAdmin(adminId)) {
      return bot.sendMessage(chatId, '❌ Hanya admin yang dapat menggunakan perintah ini.', {
        ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
      });
    }

    const deletedUser = deleteUser(userIdToDelete);

    if (!deletedUser) {
      return bot.sendMessage(chatId, '❌ User tidak ditemukan dalam database.', {
        ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
      });
    }

    bot.sendMessage(chatId, `✅ User berhasil dihapus!\n\n*Nama:* ${deletedUser.nama}\n*ID:* ${userIdToDelete}`, {
      parse_mode: 'Markdown',
      ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
    });

  } catch (error) {
    console.error('Error in /hapus_user:', error.message);
  }
}

function handleNewChatMembers(bot, msg) {
  try {
    const chatId = msg.chat.id;
    
    msg.new_chat_members.forEach((member) => {
      const userId = member.id;
      const userName = member.first_name || 'User';
      
      const adminMessage = `👤 *User Baru Bergabung*\n\n` +
        `Nama: ${userName}\n` +
        `ID: ${userId}\n\n` +
        `Untuk mendaftarkan user ini, gunakan perintah:\n` +
        `/daftar ${userId} "Nama User" "Link" "Artikel"`;
      
      bot.sendMessage(chatId, adminMessage, {
        parse_mode: 'Markdown',
        ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
      });
    });
  } catch (error) {
    console.error('Error in new_chat_members handler:', error.message);
  }
}

// Helper functions
function isAdmin(userId) {
  const adminIds = process.env.ADMIN_IDS ? 
    process.env.ADMIN_IDS.split(',').map(id => id.trim()) : [];
  return adminIds.includes(userId.toString());
}

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

function sendAnnouncement(bot, telegramId, userName, link, artikel) {
  const groupChatId = process.env.TELEGRAM_GROUP_CHAT_ID;
  const pengumumanThreadId = process.env.PENGUMUMAN_THREAD_ID;
  
  if (!groupChatId) return;
  
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
  
  bot.sendMessage(groupChatId, pengumumanMessage, pengumumanOptions)
    .then(() => console.log(`✅ Announcement sent for user: ${userName}`))
    .catch(error => console.error('Error sending announcement:', error.message));
}

module.exports = {
  handleDaftar,
  handleLihatUser,
  handleHapusUser,
  handleNewChatMembers
};
