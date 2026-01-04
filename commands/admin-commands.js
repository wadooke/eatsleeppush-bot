// commands/admin-commands.js - PERBAIKAN
const { addUser } = require('../data/user-database');

// TAMBAHKAN 'async' DI SINI ↓
async function handleDaftar(bot, msg, match) {
  try {
    const chatId = msg.chat.id;
    const adminId = msg.from.id;
    const fullArgs = match[1];

    // Check admin permissions
    if (!isAdmin(adminId)) {
      return await bot.sendMessage(chatId, '❌ Hanya admin yang dapat menggunakan perintah ini.', {
        ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
      });
    }

    // Parse arguments with quoted string support
    const args = parseQuotedArguments(fullArgs);

    // Validasi: 4 parameter (id, nama, shortlink, destinationUrl)
    if (args.length < 4) {
      return await bot.sendMessage(chatId, '❌ Format salah! Gunakan: /daftar id_telegram "Nama" "Shortlink" "URL_Tujuan"', {
        ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
      });
    }

    const [telegramId, userName, shortLink, destinationUrl] = args;

    // Validasi telegram ID
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

    // Add to database
    addUser(telegramId, userData);

    // Send confirmation to admin
    await bot.sendMessage(chatId, `✅ User berhasil didaftarkan!\n\nID: ${telegramId}\nNama: ${userName}\nShortlink: ${shortLink}`, {
      ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
    });

    // Send announcement
    await sendAnnouncement(bot, telegramId, userName, shortLink, destinationUrl);

  } catch (error) {
    console.error('Error in /daftar:', error.message);
  }
}

// Helper functions tetap sama...
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

// Juga tambahkan 'async' di fungsi ini
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

module.exports = {
  handleDaftar,
  handleLihatUser,
  handleHapusUser,
  handleNewChatMembers
};
