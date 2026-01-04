// commands/user-commands.js - VERSI FINAL DENGAN FIXES
const { fetchUserArticleData, formatCustomReport } = require('../utils/ga4-reports');
const { getUser } = require('../data/user-database'); // IMPORT LANGSUNG

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

function handleUserid(bot, msg) {
  try {
    const chatId = msg.chat.id;
    
    // Check if command is from correct group
    if (String(chatId) !== process.env.TELEGRAM_GROUP_CHAT_ID) {
      return bot.sendMessage(chatId, 'Perintah ini hanya dapat digunakan di grup EatSleepPush.');
    }

    const userId = msg.from.id;
    const userName = escapeHtml(msg.from.first_name || 'User');
    
    bot.sendMessage(chatId, 
      `👤 <b>ID Telegram Anda:</b>\n<code>${userId}</code>\n\n<b>Nama:</b> ${userName}\n\nSalin ID ini untuk pendaftaran.`, 
      {
        parse_mode: 'HTML', // DIUBAH
        ...(msg.message_thread_id && { message_thread_id: msg.message_thread_id })
      }
    );
  } catch (error) {
    console.error('❌ Error in /userid:', error.message);
  }
}

async function handleCekvar(bot, msg, analyticsDataClient) {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const userName = escapeHtml(msg.from.first_name || 'Sahabat');

  // Check if command is from correct group
  if (String(chatId) !== process.env.TELEGRAM_GROUP_CHAT_ID) {
    return bot.sendMessage(chatId, 'Perintah ini hanya dapat digunakan di grup EatSleepPush.');
  }

  let processingMsg;
  try {
    // Send processing message
    processingMsg = await bot.sendMessage(
      chatId, 
      `Halo ${userName}... 🔍 Sedang mengambil data artikel Anda dari GA4...`,
      { parse_mode: 'HTML' } // DIUBAH
    );

    if (!analyticsDataClient) {
      throw new Error('GA4 Client belum diinisialisasi');
    }

    // 1. CEK APAKAH USER TERDAFTAR
    const userData = getUser(userId); // LANGSUNG PAKAI getUser
    
    if (!userData) {
      throw new Error('Anda belum terdaftar. Silakan minta admin mendaftarkan Anda dengan /daftar');
    }

    // 2. AMBIL DATA GA4 KHUSUS UNTUK ARTIKEL USER INI
    console.log(`[QUERY] Mengambil data untuk: ${userData.nama} (Path: ${userData.ga4Path})`);
    const articleData = await fetchUserArticleData(analyticsDataClient, userData);
    
    // 3. FORMAT LAPORAN SESUAI PERMINTAAN
    const reportMessage = formatCustomReport(userData, articleData);
    
    // Edit message with report
    await bot.editMessageText(reportMessage, {
      chat_id: chatId,
      message_id: processingMsg.message_id,
      parse_mode: 'HTML' // DIUBAH
    });

  } catch (error) {
    console.error('❌ Error dalam /cekvar:', error.message);
    
    // Send error message to Telegram
    const errorMessage = `❌ <b>Gagal mengambil data artikel:</b>\n<code>${escapeHtml(error.message)}</code>`;
    
    if (processingMsg) {
      try {
        await bot.editMessageText(errorMessage, {
          chat_id: chatId,
          message_id: processingMsg.message_id,
          parse_mode: 'HTML' // DIUBAH
        });
      } catch {
        await bot.sendMessage(chatId, errorMessage, { parse_mode: 'HTML' });
      }
    } else {
      await bot.sendMessage(chatId, errorMessage, { parse_mode: 'HTML' });
    }
  }
}

module.exports = {
  handleUserid,
  handleCekvar
};
