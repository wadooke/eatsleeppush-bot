// services/telegram-bot.js - Telegram bot setup
const TelegramBot = require('node-telegram-bot-api');

function initializeTelegramBot(analyticsDataClient) {
  console.log('🤖 Initializing Telegram Bot...');
  
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error('❌ TELEGRAM_BOT_TOKEN not found in environment');
    return null;
  }
  
  // Initialize bot with webhook mode
  const bot = new TelegramBot(token, {
    polling: false,
    onlyFirstMatch: true
  });
  
  console.log(`   Bot: @${bot.getMe().then(me => me.username).catch(() => 'Unknown')}`);
  
  // Import command handlers
  const adminCommands = require('../commands/admin-commands');
  const userCommands = require('../commands/user-commands');
  const reportCommands = require('../commands/report-commands');
  
  // Setup command handlers
  setupCommandHandlers(bot, analyticsDataClient);
  
  // Setup webhook
  setupWebhook(bot);
  
  return bot;
}

function setupCommandHandlers(bot, analyticsDataClient) {
  console.log('   Setting up command handlers...');
  
  // Import handlers
  const adminCommands = require('../commands/admin-commands');
  const userCommands = require('../commands/user-commands');
  const reportCommands = require('../commands/report-commands');
  
  // Admin commands
  bot.onText(/\/daftar (.+)/, (msg, match) => 
    adminCommands.handleDaftar(bot, msg, match));
  
  bot.onText(/\/lihat_user/, (msg) => 
    adminCommands.handleLihatUser(bot, msg));
  
  bot.onText(/\/hapus_user (.+)/, (msg, match) => 
    adminCommands.handleHapusUser(bot, msg, match));
  
  // User commands
  bot.onText(/\/userid/, (msg) => 
    userCommands.handleUserid(bot, msg));
  
  bot.onText(/\/cekvar/, (msg) => 
    userCommands.handleCekvar(bot, msg, analyticsDataClient));
  
  // Report commands
  bot.onText(/\/laporan_sekarang/, (msg) => 
    reportCommands.handleLaporanSekarang(bot, msg, analyticsDataClient));
  
  bot.onText(/\/debug_ga4/, (msg) => 
    reportCommands.handleDebugGA4(bot, msg, analyticsDataClient));
  
  // New chat members event
  bot.on('new_chat_members', (msg) => 
    adminCommands.handleNewChatMembers(bot, msg));
  
  console.log(`   ✅ ${Object.keys(bot._events).length} handlers registered`);
}

function setupWebhook(bot) {
  const webhookUrl = process.env.RAILWAY_STATIC_URL || process.env.RENDER_EXTERNAL_URL;
  
  if (!webhookUrl) {
    console.error('❌ No webhook URL found in environment');
    return;
  }
  
  const fullWebhookUrl = webhookUrl.startsWith('http') 
    ? `${webhookUrl}/telegram-webhook`
    : `https://${webhookUrl}/telegram-webhook`;
  
  bot.setWebHook(fullWebhookUrl, {
    max_connections: 40,
    allowed_updates: ['message', 'chat_member']
  })
  .then(() => {
    console.log(`✅ Webhook set to: ${fullWebhookUrl}`);
    sendStartupMessage(bot);
  })
  .catch(error => {
    console.error('❌ Failed to set webhook:', error.message);
  });
}

async function sendStartupMessage(bot) {
  const groupChatId = process.env.TELEGRAM_GROUP_CHAT_ID;
  const laporanThreadId = process.env.LAPORAN_THREAD_ID;
  
  if (!groupChatId) return;
  
  try {
    await bot.sendMessage(groupChatId, 
      '✅ *Bot Laporan GA4 telah aktif!*\n\n' +
      '*Perintah User:*\n' +
      '• /userid - Lihat ID Telegram Anda\n' +
      '• /cekvar - Laporan realtime 30 menit\n\n' +
      '*Perintah Admin:*\n' +
      '• /daftar id "Nama" "Link" "Artikel"\n' +
      '• /lihat_user - Lihat user terdaftar\n' +
      '• /hapus_user id - Hapus user\n' +
      '• /laporan_sekarang - Kirim laporan manual\n' +
      '• /debug_ga4 - Test koneksi GA4',
      {
        parse_mode: 'Markdown',
        ...(laporanThreadId && { message_thread_id: parseInt(laporanThreadId) })
      }
    );
    console.log('✅ Startup message sent to group');
  } catch (error) {
    console.error('❌ Failed to send startup message:', error.message);
  }
}

module.exports = { initializeTelegramBot };
