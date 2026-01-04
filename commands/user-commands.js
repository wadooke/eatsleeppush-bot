// commands/user-commands.js
const { fetchUserArticleData, formatCustomReport } = require('../utils/ga4-reports');

function handleUserid(bot, msg) {
  try {
    const chatId = msg.chat.id;
    
    // Check if command is from correct group
    if (String(chatId) !== process.env.TELEGRAM_GROUP_CHAT_ID) {
      return bot.sendMessage(chatId, 'Perintah ini hanya dapat digunakan di grup EatSleepPush.');
    }

    const userId = msg.from.id;
    const userName = msg.from.first_name || 'User';
    
    bot.sendMessage(chatId, `👤 *ID Telegram Anda:*\n${userId}\n\n*Nama:* ${userName}\n\nSalin ID ini untuk pendaftaran.`, {
      parse_mode: 'Markdown',
      ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
    });
  } catch (error) {
    console.error('Error in /userid:', error.message);
  }
}

async function handleCekvar(bot, msg, analyticsDataClient) {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const userName = msg.from.first_name || 'Sahabat';

  // Check if command is from correct group
  if (String(chatId) !== process.env.TELEGRAM_GROUP_CHAT_ID) {
    return bot.sendMessage(chatId, 'Perintah ini hanya dapat digunakan di grup EatSleepPush.');
  }

  let processingMsg;
  try {
    // Send processing message
    processingMsg = await bot.sendMessage(chatId, `Halo ${userName}... 🔍 Sedang mengambil data artikel Anda dari GA4...`);

    if (!analyticsDataClient) {
      throw new Error('GA4 Client belum diinisialisasi');
    }

    // 1. CEK APAKAH USER TERDAFTAR
    const { getUser } = require('../data/user-database');
    const userData = getUser(userId);
    
    if (!userData) {
      throw new Error('Anda belum terdaftar. Silakan minta admin mendaftarkan Anda dengan /daftar');
    }

    // 2. AMBIL DATA GA4 KHUSUS UNTUK ARTIKEL USER INI
    const articleData = await fetchUserArticleData(analyticsDataClient, userData);
    
    // 3. FORMAT LAPORAN SESUAI PERMINTAAN
    const reportMessage = formatCustomReport(userData, articleData);
    
    // Edit message with report
    await bot.editMessageText(reportMessage, {
      chat_id: chatId,
      message_id: processingMsg.message_id,
      parse_mode: 'Markdown'
    });

  } catch (error) {
    console.error('❌ Error dalam /cekvar:', error.message);
    
    // Send error message to Telegram
    const errorMessage = `❌ *Gagal mengambil data artikel:*\n${error.message}`;
    
    if (processingMsg) {
      try {
        await bot.editMessageText(errorMessage, {
          chat_id: chatId,
          message_id: processingMsg.message_id,
          parse_mode: 'Markdown'
        });
      } catch {
        await bot.sendMessage(chatId, errorMessage, { parse_mode: 'Markdown' });
      }
    } else {
      await bot.sendMessage(chatId, errorMessage, { parse_mode: 'Markdown' });
    }
  }
}

module.exports = {
  handleUserid,
  handleCekvar
};
