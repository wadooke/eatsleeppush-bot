// services/telegram-bot.js - Telegram bot setup dengan Access Control & Thread Management (FIXED)
const TelegramBot = require('node-telegram-bot-api');
const adminCommands = require('../commands/admin-commands');
const userCommands = require('../commands/user-commands');
const reportCommands = require('../commands/report-commands');
const accessControl = require('../utils/access-control');

// Variabel global untuk track status webhook
let webhookSetupAttempted = false;
let webhookSetupSuccess = false;

function initializeTelegramBot(analyticsDataClient) {
  console.log('🤖 Initializing Telegram Bot with Access Control...');
  
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error('❌ TELEGRAM_BOT_TOKEN not found in environment');
    return null;
  }
  
  // Bot username untuk command matching
  const BOT_USERNAME = process.env.BOT_USERNAME || 'eatsleeppush_bot';
  
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
      console.log(`✅ Bot connected: @${me.username} (${me.first_name})`);
      console.log(`   Bot Username: @${BOT_USERNAME} (from config)`);
    })
    .catch(error => {
      console.error(`❌ Cannot connect to Telegram API: ${error.message}`);
    });
  
  // Setup command handlers dengan middleware access control
  console.log('   Setting up command handlers with thread access control...');
  setupCommandHandlers(bot, analyticsDataClient, BOT_USERNAME);
  
  // Setup webhook (hanya sekali)
  if (!webhookSetupAttempted) {
    setupWebhook(bot);
    webhookSetupAttempted = true;
  }
  
  // Setup event handler untuk new chat members
  setupEventHandlers(bot);
  
  return bot;
}

function setupEventHandlers(bot) {
  // Handler untuk new chat members (tanpa access control karena ini event bot)
  bot.on('new_chat_members', (msg) => {
    try {
      // Biarkan admin-commands.js handle ini
      adminCommands.handleNewChatMembers(bot, msg);
    } catch (error) {
      console.error('❌ Error in new_chat_members handler:', error.message);
    }
  });
  
  // Handler untuk left chat members (optional)
  bot.on('left_chat_member', (msg) => {
    try {
      console.log(`👤 User left: ${msg.left_chat_member?.first_name} (ID: ${msg.left_chat_member?.id})`);
    } catch (error) {
      console.error('❌ Error in left_chat_member handler:', error.message);
    }
  });
}

// Di telegram-bot.js, update setupCommandHandlers:
function setupCommandHandlers(bot, analyticsDataClient, botUsername) {
  const accessControl = require('../utils/access-control');
  
  // STRICT Middleware untuk semua incoming messages
  bot.on('message', (msg) => {
    try {
      // Skip jika dari bot sendiri
      if (msg.from?.is_bot) return;
      
      console.log(`📨 STRICT Filter: Message from ${msg.from?.id} (${msg.from?.first_name})`);
      
      // Gunakan STRICT access control middleware
      accessControl.checkAccess(bot, msg, () => {
        // HANYA jika lolos strict access control, proses command
        const fullCommand = msg.text?.split(' ')[0] || '';
        const command = fullCommand.split('@')[0];
        processCommand(bot, msg, analyticsDataClient, command, botUsername);
      });
      
    } catch (error) {
      console.error('❌ Error in strict message middleware:', error.message);
    }
  });
  
  console.log(`   ✅ STRICT Access Control System Activated`);
  console.log(`   🔴 Unregistered users will be AUTO-KICKED`);
}

function processCommand(bot, msg, analyticsDataClient, command, botUsername) {
  const text = msg.text;
  const chatId = msg.chat.id;
  const threadId = msg.message_thread_id || 0;
  
  try {
    // Helper function untuk validasi command dengan @username
    const isCommand = (cmd) => {
      // Check if command matches exactly or with @username
      const regex = new RegExp(`^${cmd}(@${botUsername})?(\\s|$)`);
      return regex.test(text);
    };
    
    // Helper untuk extract arguments
    const getArgs = (cmd) => {
      const regex = new RegExp(`^${cmd}(@${botUsername})?\\s+(.+)$`);
      const match = text.match(regex);
      return match ? match[match.length - 1] : null;
    };
    
    // Admin commands (bisa diakses dari thread manapun oleh admin)
    if (isCommand('/daftar')) {
      const args = getArgs('/daftar');
      if (args) adminCommands.handleDaftar(bot, msg, args);
    } 
    else if (isCommand('/lihat_user')) {
      adminCommands.handleLihatUser(bot, msg);
    } 
    else if (isCommand('/hapus_user')) {
      const args = getArgs('/hapus_user');
      if (args) adminCommands.handleHapusUser(bot, msg, args);
    }
    else if (isCommand('/reset_rate_limit')) {
      const args = getArgs('/reset_rate_limit');
      if (args) adminCommands.handleResetRateLimit(bot, msg, args);
    }
    
    // User commands (subject to thread access control)
    else if (isCommand('/userid')) {
      userCommands.handleUserid(bot, msg);
    } 
    else if (isCommand('/cekvar')) {
      userCommands.handleCekvar(bot, msg, analyticsDataClient);
    } 
    else if (isCommand('/cekvar_stats')) {
      userCommands.handleCekvarStats(bot, msg);
    }
    else if (isCommand('/profil')) {
      userCommands.handleProfil(bot, msg);
    }
    else if (isCommand('/bantuan')) {
      userCommands.handleBantuan(bot, msg);
    }
    
    // Report commands (admin only)
    else if (isCommand('/laporan_sekarang')) {
      reportCommands.handleLaporanSekarang(bot, msg, analyticsDataClient);
    } 
    else if (isCommand('/debug_ga4')) {
      reportCommands.handleDebugGA4(bot, msg, analyticsDataClient);
    }
    
    // Handle /start command (delegasi ke index.js)
    else if (isCommand('/start')) {
      // Biarkan index.js menangani /start command
      console.log(`   ⏩ /start command forwarded to index.js handler`);
      // Tidak melakukan apa-apa, biarkan handler di index.js yang menangani
    }
    else if (isCommand('/scheduler_status') || isCommand('/report_revenue')) {
      // Biarkan index.js menangani command ini
      console.log(`   ⏩ ${command} command forwarded to index.js handler`);
      // Tidak melakukan apa-apa, biarkan handler di index.js yang menangani
    }
    
    // Unknown command - HANYA untuk command yang benar-benar tidak dikenali
    else if (command.startsWith('/')) {
      console.log(`❓ Unknown command in telegram-bot.js: ${text}`);
      
      // Cek apakah ini command untuk index.js
      const indexJsCommands = ['/start', '/scheduler_status', '/report_revenue'];
      const isForIndexJs = indexJsCommands.some(cmd => 
        new RegExp(`^${cmd}(@${botUsername})?`).test(text)
      );
      
      if (!isForIndexJs) {
        // Kirim pesan bantuan HANYA untuk command yang benar-benar tidak dikenali
        bot.sendMessage(chatId, 
          `❓ <b>Perintah tidak dikenali:</b> <code>${text}</code>\n\n` +
          `Gunakan <code>/bantuan</code> untuk melihat daftar perintah yang tersedia.`,
          {
            parse_mode: 'HTML',
            ...(threadId && { message_thread_id: threadId })
          }
        ).catch(() => {});
      }
    }
    
  } catch (error) {
    console.error('❌ Error processing command in telegram-bot.js:', error.message);
    console.error(error.stack);
    
    // Kirim error message ke user
    try {
      const escapeHtml = (str) => {
        if (!str) return '';
        return str
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      };
      
      bot.sendMessage(chatId,
        `❌ <b>Terjadi kesalahan sistem</b>\n\n` +
        `<code>${escapeHtml(error.message)}</code>\n\n` +
        `Silakan coba lagi atau hubungi admin jika masalah berlanjut.`,
        {
          parse_mode: 'HTML',
          ...(threadId && { message_thread_id: threadId })
        }
      ).catch(() => {});
    } catch (sendError) {
      console.error('❌ Failed to send error message:', sendError.message);
    }
  }
}

async function setupWebhook(bot) {
  console.log('🔗 Setting up Telegram webhook...');
  
  const webhookUrl = process.env.RAILWAY_STATIC_URL || process.env.RENDER_EXTERNAL_URL;
  
  if (!webhookUrl) {
    console.error('❌ ERROR: No webhook URL found in environment variables');
    console.error('   Please set RAILWAY_STATIC_URL or RENDER_EXTERNAL_URL');
    webhookSetupSuccess = false;
    return false;
  }

  // Format URL dengan benar
  let fullWebhookUrl;
  if (webhookUrl.includes('://')) {
    fullWebhookUrl = `${webhookUrl.replace(/\/$/, '')}/telegram-webhook`;
  } else {
    fullWebhookUrl = `https://${webhookUrl.replace(/\/$/, '')}/telegram-webhook`;
  }
  
  console.log(`   Webhook target: ${fullWebhookUrl}`);
  
  try {
    // 1. Cek status webhook saat ini
    const currentInfo = await bot.getWebHookInfo();
    console.log(`   Current webhook: ${currentInfo.url || 'None'}`);
    
    // 2. Hanya set webhook jika URL berbeda
    if (currentInfo.url === fullWebhookUrl) {
      console.log('✅ Webhook already correctly set');
      webhookSetupSuccess = true;
      
      // Kirim startup message
      sendStartupMessage(bot, true);
      return true;
    }
    
    // 3. Hapus webhook lama jika ada
    if (currentInfo.url) {
      console.log(`   Removing old webhook: ${currentInfo.url}`);
      await bot.deleteWebHook();
      console.log('✅ Old webhook removed');
      // Tunggu sebentar
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // 4. Set webhook baru dengan allowed updates yang spesifik
    console.log('   Setting new webhook...');
    await bot.setWebHook(fullWebhookUrl, {
      max_connections: 40,
      allowed_updates: ['message', 'chat_member', 'callback_query'],
      drop_pending_updates: true // Hapus pending updates lama
    });
    
    console.log(`✅ Webhook successfully set to: ${fullWebhookUrl}`);
    
    // 5. Verifikasi
    await new Promise(resolve => setTimeout(resolve, 2000));
    const newInfo = await bot.getWebHookInfo();
    console.log(`ℹ️  Verified: ${newInfo.url ? 'ACTIVE' : 'INACTIVE'}`);
    
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
  const pengumumanThreadId = parseInt(process.env.PENGUMUMAN_THREAD_ID || 9);
  
  if (!groupChatId) {
    console.log('⚠️  No group chat ID, skipping startup message');
    return;
  }
  
  try {
    const status = webhookActive ? 'aktif' : 'terbatas';
    const statusIcon = webhookActive ? '✅' : '⚠️';
    
    // Format waktu startup
    const startupTime = new Date().toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).replace(/\./g, ':');
    
    const message = `${statusIcon} *EatSleepPush GA4 Bot telah ${status}!*\n\n` +
      `*📅 Tanggal:* ${new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n` +
      `*⏰ Waktu Startup:* ${startupTime}\n` +
      `*🔧 Status Webhook:* ${webhookActive ? 'AKTIF' : 'TERBATAS'}\n\n` +
      
      `*🔒 TOPIK AKSES USER:*\n` +
      `✅ #DISKUSI-UMUM (Thread ID: 1)\n` +
      `✅ #APLIKASI (Thread ID: 7)\n` +
      `✅ #TUTORIAL (Thread ID: 5)\n\n` +
      
      `*🤖 TOPIK KHUSUS BOT:*\n` +
      `📊 #LAPORAN (Thread ID: 3) - hanya untuk laporan /cekvar\n` +
      `📢 #PENGUMUMAN (Thread ID: 9) - hanya pengumuman\n\n` +
      
      `*⚡ RATE LIMITING:*\n` +
      `• /cekvar cooldown: ${process.env.CEKVAR_COOLDOWN_MINUTES || 30} menit\n` +
      `• Maksimal: ${process.env.MAX_REQUESTS_PER_HOUR || 10}x per jam\n\n` +
      
      `*🆕 COMMAND BARU (Support @username):*\n` +
      `• /start - Menu utama (support @eatsleeppush_bot)\n` +
      `• /scheduler_status - Status scheduler (support @username)\n\n` +
      
      `_Bot siap melayani! Gunakan /bantuan untuk panduan lengkap._`;
    
    const options = {
      parse_mode: 'Markdown',
      message_thread_id: pengumumanThreadId
    };
    
    await bot.sendMessage(groupChatId, message, options);
    console.log(`✅ Startup message sent to thread ${pengumumanThreadId} (webhook: ${webhookActive ? 'active' : 'limited'})`);
    
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
