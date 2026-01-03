// commands/user-commands.js - User command handlers
const { fetchGA4RealtimeData } = require('../utils/ga4-reports');

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
  const userName = msg.from.first_name || 'Sahabat';

  // Check if command is from correct group
  if (String(chatId) !== process.env.TELEGRAM_GROUP_CHAT_ID) {
    return bot.sendMessage(chatId, 'Perintah ini hanya dapat digunakan di grup EatSleepPush.');
  }

  let processingMsg;
  try {
    // Send processing message
    processingMsg = await bot.sendMessage(chatId, `Halo ${userName}... 🔍 Sedang mengambil data realtime dari GA4...`);

    if (!analyticsDataClient) {
      throw new Error('GA4 Client belum diinisialisasi');
    }

    // Fetch GA4 realtime data
    const reportMessage = await fetchGA4RealtimeData(analyticsDataClient, userName);
    
    // Edit message with report
    await bot.editMessageText(reportMessage, {
      chat_id: chatId,
      message_id: processingMsg.message_id,
      parse_mode: 'Markdown'
    });

  } catch (error) {
    console.error('❌ Error Detail dalam /cekvar:');
    console.error('Pesan:', error.message);
    console.error('Kode:', error.code);
    console.error('Detail:', error.details);
    console.error('Metadata:', error.metadata);
    
    // Send error message to Telegram
    const errorMessage = `❌ *Gagal mengambil data realtime.*\n\nSilakan coba lagi nanti.`;
    
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
