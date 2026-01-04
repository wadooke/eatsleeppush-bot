// services/telegram-bot.js - Telegram bot setup dengan FIX untuk webhook loop
const TelegramBot = require('node-telegram-bot-api');
const adminCommands = require('../commands/admin-commands');
const userCommands = require('../commands/user-commands');
const reportCommands = require('../commands/report-commands');

// Variabel global untuk track status webhook
let webhookSetupAttempted = false;
let webhookSetupSuccess = false;

function initializeTelegramBot(analyticsDataClient) {
  console.log('🤖 Initializing Telegram Bot...');
  
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error('❌ TELEGRAM_BOT_TOKEN not found in environment');
    return null;
  }
  
  // Inisialisasi bot TANPA polling (hanya untuk webhook)
  const bot = new TelegramBot(token, {
    polling: false, // SANGAT PENTING: polling harus false
    onlyFirstMatch: true,
    request: {
      timeout: 10000 // 10 detik timeout
    }
  });
  
  // Test koneksi bot
  bot.getMe()
    .then(me => {
      console.log(`   Bot: @${me.username} (${me.first_name})`);
    })
    .catch(error => {
      console.error(`   ❌ Cannot connect to Telegram API: ${error.message}`);
    });
  
  // Setup command handlers
  console.log('   Setting up command handlers...');
  setupCommandHandlers(bot, analyticsDataClient);
  
  // Setup webhook (hanya sekali)
  if (!webhookSetupAttempted) {
    setupWebhook(bot);
    webhookSetupAttempted = true;
  }
  
  return bot;
}

function setupCommandHandlers(bot, analyticsDataClient) {
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
  
  // Error handler untuk semua commands
  bot.on('polling_error', (error) => {
    console.error('❌ Telegram polling error:', error.message);
  });
  
  bot.on('webhook_error', (error) => {
    console.error('❌ Telegram webhook error:', error.message);
  });
  
  console.log(`   ✅ ${Object.keys(bot._events).length} handlers registered`);
}

async function setupWebhook(bot) {
  console.log('🔗 Setting up Telegram webhook...');
  
  const webhookUrl = process.env.RAILWAY_STATIC_URL || process.env.RENDER_EXTERNAL_URL;
  
  if (!webhookUrl) {
    console.error('❌ ERROR: No webhook URL found in environment variables');
    console.error('   Please set RAILWAY_STATIC_URL or RENDER_EXTERNAL_URL in Railway');
    console.error('   Example: https://eatsleeppush-bot-production.up.railway.app');
    webhookSetupSuccess = false;
    return false;
  }

  // Format URL dengan benar
  let fullWebhookUrl;
  if (webhookUrl.includes('://')) {
    // URL sudah lengkap
    fullWebhookUrl = `${webhookUrl.replace(/\/$/, '')}/telegram-webhook`;
  } else {
    // Hanya domain, tambahkan https://
    fullWebhookUrl = `https://${webhookUrl.replace(/\/$/, '')}/telegram-webhook`;
  }
  
  console.log(`   Webhook target: ${fullWebhookUrl}`);
  console.log('   Checking current webhook status...');
  
  try {
    // 1. Cek status webhook saat ini
    const currentInfo = await bot.getWebHookInfo();
    console.log(`   Current webhook: ${currentInfo.url || 'None'}`);
    console.log(`   Pending updates: ${currentInfo.pending_update_count}`);
    
    // 2. Hanya set webhook jika URL berbeda
    if (currentInfo.url === fullWebhookUrl) {
      console.log('   ✅ Webhook already correctly set');
      webhookSetupSuccess = true;
      
      // Kirim startup message
      sendStartupMessage(bot, true);
      return true;
    }
    
    // 3. Hapus webhook lama jika ada
    if (currentInfo.url) {
      console.log(`   Removing old webhook: ${currentInfo.url}`);
      await bot.deleteWebHook();
      console.log('   ✅ Old webhook removed');
      // Tunggu sebentar
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // 4. Set webhook baru
    console.log('   Setting new webhook...');
    const result = await bot.setWebHook(fullWebhookUrl, {
      max_connections: 40,
      allowed_updates: ['message', 'chat_member'],
      drop_pending_updates: true // Hapus pending updates lama
    });
    
    console.log(`✅ Webhook successfully set to: ${fullWebhookUrl}`);
    
    // 5. Verifikasi
    await new Promise(resolve => setTimeout(resolve, 2000)); // Tunggu 2 detik
    const newInfo = await bot.getWebHookInfo();
    console.log(`ℹ️  Verified: ${newInfo.url ? 'ACTIVE' : 'INACTIVE'}`);
    console.log(`   Pending updates: ${newInfo.pending_update_count}`);
    
    webhookSetupSuccess = true;
    
    // 6. Kirim startup message
    sendStartupMessage(bot, true);
    
    return true;
    
  } catch (error) {
    console.error('❌ ERROR setting webhook:');
    console.error('   Message:', error.message);
    
    // Log detail error tanpa menyebabkan loop
    if (error.response) {
      console.error('   Status Code:', error.response.statusCode);
      if (error.response.body) {
        try {
          const errorBody = JSON.parse(error.response.body);
          console.error('   Telegram API Error:', errorBody.description);
        } catch (e) {
          console.error('   Raw Error:', error.response.body);
        }
      }
    }
    
    webhookSetupSuccess = false;
    
    // Fallback: Kirim message bahwa bot berjalan tanpa webhook
    sendStartupMessage(bot, false);
    
    return false;
  }
}

async function sendStartupMessage(bot, webhookActive) {
  const groupChatId = process.env.TELEGRAM_GROUP_CHAT_ID;
  const laporanThreadId = process.env.LAPORAN_THREAD_ID;
  
  if (!groupChatId) {
    console.log('⚠️  No group chat ID, skipping startup message');
    return;
  }
  
  try {
    const status = webhookActive ? 'aktif' : 'terbatas';
    const statusIcon = webhookActive ? '✅' : '⚠️';
    
    const message = `${statusIcon} *Bot Laporan GA4 telah ${status}!*\n\n` +
      `*Perintah User:*\n` +
      `• /userid - Lihat ID Telegram Anda\n` +
      `• /cekvar - Laporan artikel Anda (hanya user terdaftar)\n\n` +
      `*Perintah Admin:*\n` +
      `• /daftar id "Nama" "Shortlink" "URL"\n` +
      `• /lihat_user - Lihat user terdaftar\n` +
      `• /hapus_user id - Hapus user\n` +
      `• /laporan_sekarang - Kirim laporan manual\n` +
      `• /debug_ga4 - Test koneksi GA4\n\n` +
      `_Status Webhook: ${webhookActive ? 'AKTIF' : 'TERBATAS'}_`;
    
    const options = {
      parse_mode: 'Markdown',
      ...(laporanThreadId && { message_thread_id: parseInt(laporanThreadId) })
    };
    
    await bot.sendMessage(groupChatId, message, options);
    console.log(`✅ Startup message sent (webhook: ${webhookActive ? 'active' : 'limited'})`);
    
  } catch (error) {
    console.error('❌ Failed to send startup message:', error.message);
  }
}

// Export fungsi untuk testing/management
module.exports = {
  initializeTelegramBot,
  getWebhookStatus: () => ({
    attempted: webhookSetupAttempted,
    success: webhookSetupSuccess
  })
};
