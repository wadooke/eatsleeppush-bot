// index.js - FINAL COMPLETE VERSION dengan Strict Access Control
const express = require('express');

// Load environment ONCE
require('dotenv').config();

console.log('[dotenv@17.2.3] injecting env (0) from .env');
console.log('📋 Loading environment configuration...');

const TELEGRAM_GROUP_CHAT_ID = process.env.TELEGRAM_GROUP_CHAT_ID;
const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID;
const ADMIN_CHAT_ID = process.env.ADMIN_IDS || '185472876';
const BOT_USERNAME = process.env.BOT_USERNAME || 'eatsleeppush_bot';

console.log('✅ Environment variables loaded successfully');
console.log(`   Group Chat ID: ${TELEGRAM_GROUP_CHAT_ID}`);
console.log(`   GA4 Property ID: ${GA4_PROPERTY_ID}`);
console.log(`   Admin Chat ID: ${ADMIN_CHAT_ID}`);
console.log(`   Bot Username: @${BOT_USERNAME}`);

// Initialize Express
const app = express();
app.use(express.json());

// Initialize database FIRST
console.log('💾 Initializing user database...');
const userDatabase = require('./data/user-database'); // Load database

// Tunggu database selesai load
setTimeout(async () => {
  console.log(`   ✅ Loaded ${Object.keys(userDatabase.users).length} registered users`);
  
  // Initialize GA4 Client
  console.log('🔧 Initializing GA4 Client...');
  const { initializeGA4Client } = require('./services/ga4-client');
  const analyticsDataClient = initializeGA4Client();
  
  if (!analyticsDataClient) {
    console.error('❌ GA4 Client initialization failed!');
    return;
  }
  
  console.log('✅ GA4 Client initialized successfully');
  
  // Test GA4 connection
  console.log('🧪 [DIAGNOSTICS] Starting GA4 connection test...');
  console.log(`   Property ID: "${GA4_PROPERTY_ID}"`);
  console.log('   Testing with simple query...');
  
  try {
    const [response] = await analyticsDataClient.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate: '2024-01-01', endDate: 'today' }],
      dimensions: [{ name: 'date' }],
      metrics: [{ name: 'activeUsers' }],
      limit: 1
    });
    
    console.log('✅ [DIAGNOSTICS] SUCCESS! GA4 connection is VALID.');
    console.log(`      Server accepted Property ID: ${GA4_PROPERTY_ID}`);
  } catch (ga4Error) {
    console.log('⚠️  [DIAGNOSTICS] GA4 connection warning:', ga4Error.message);
    console.log('   Bot will continue but revenue reports may fail.');
  }
  
  // Initialize Telegram Bot
  console.log('🤖 Initializing Telegram Bot...');
  const { initializeTelegramBot } = require('./services/telegram-bot');
  const bot = initializeTelegramBot(analyticsDataClient);
  
  if (!bot) {
    console.error('❌ Telegram Bot initialization failed!');
    return;
  }
  
  console.log('✅ Telegram Bot initialized');

  // ============================================
  // NEW: INITIALIZE STRICT ACCESS CONTROL BOT HANDLER
  // ============================================
  console.log('🤖 Initializing Telegram Bot with Access Control...');

  try {
    // Initialize the new Telegram Bot Handler with strict access control
    const TelegramBotHandler = require('./services/telegram-bot');
    console.log('✅ Telegram Bot Handler initialized');
  
    // HENTIKAN/COMMENT KODE HANDLER LAMA di bawah ini
    // karena TelegramBotHandler baru akan menangani semua commands
    console.log('⚠️  Legacy command handlers will be overridden by strict access control system');
  
  } catch (error) {
    console.error('❌ Failed to initialize Telegram Bot Handler:', error.message);
    console.error('   Error details:', error);
    console.log('⚠️  Bot will use legacy handlers (strict access control may not work)');
  }
  
  // ============================================
  // REVENUE REPORTER & SCHEDULER INTEGRATION
  // ============================================
  console.log('💰 Initializing Revenue Reporting System...');
  
  let revenueReporter = null;
  let botScheduler = null;
  
  try {
    // 1. Initialize Revenue Reporter
    const RevenueReporter = require('./services/revenue-reporter');
    revenueReporter = new RevenueReporter(analyticsDataClient, bot);
    console.log('   ✅ Revenue Reporter initialized');
    
    // 2. Initialize Scheduler
    const BotScheduler = require('./services/scheduler');
    botScheduler = new BotScheduler(revenueReporter);
    console.log('   ✅ Bot Scheduler initialized');
    
    // 3. Start schedulers after delay
    setTimeout(() => {
      console.log('⏰ Starting automatic schedulers...');
      try {
        botScheduler.startAllSchedulers();
        console.log('   ✅ Schedulers started successfully');
        console.log('   📅 Revenue reports scheduled: 12:00 WIB daily');
      } catch (schedulerError) {
        console.error('   ❌ Failed to start schedulers:', schedulerError.message);
      }
    }, 10000); // Start after 10 seconds
    
    console.log('✅ Revenue reporting system initialized');
    
  } catch (error) {
    console.error('❌ Revenue system initialization failed:', error.message);
    console.error('   Make sure these files exist:');
    console.error('   - services/revenue-reporter.js');
    console.error('   - services/scheduler.js');
    console.error('   - reports/ folder');
  }
  
  // ============================================
  // DETERMINE BOT LIBRARY TYPE
  // ============================================
  
  // Determine bot library type
  const isTelegraf = typeof bot.command === 'function';
  const isNodeTelegramBotApi = typeof bot.on === 'function' && typeof bot.sendMessage === 'function';
  
  console.log(`🔧 Bot library detected: ${isTelegraf ? 'Telegraf' : isNodeTelegramBotApi ? 'node-telegram-bot-api' : 'Unknown'}`);
  
  // ============================================
  // START COMMAND HANDLER (HANYA untuk command index.js)
  // ============================================
  
  if (isTelegraf) {
    // For Telegraf - Handler untuk /start (ONLY for index.js commands)
    bot.command('start', async (ctx) => {
      const userId = ctx.from.id.toString();
      const userName = ctx.from.first_name || 'Pengguna';
      
      console.log(`🤝 User ${userName} (${userId}) accessed /start command`);
      
      await ctx.reply(
        `Halo ${userName}! 👋\n\n` +
        `Selamat datang di <b>EatSleepPush GA4 Bot</b>.\n\n` +
        `🤖 <b>Bot ini dapat:</b>\n` +
        `• Mengirim laporan analytics harian\n` +
        `• Menampilkan statistik GA4\n` +
        `• User management & reporting\n\n` +
        `🛠 <b>Status Sistem:</b>\n` +
        `• GA4: ✅ Terhubung\n` +
        `• Scheduler: ✅ Aktif\n` +
        `• Laporan: 12:00 WIB setiap hari\n\n` +
        `📋 <b>Commands untuk Semua User:</b>\n` +
        `/start - Tampilkan pesan ini\n` +
        `/scheduler_status - Cek status scheduler\n\n` +
        `👑 <b>Commands Admin Only:</b>\n` +
        `/report_revenue - Generate laporan revenue\n\n` +
        `🔒 <b>ATURAN AKSES KETAT:</b>\n` +
        `• User tidak terdaftar: ❌ Tidak bisa apa-apa\n` +
        `• User terdaftar: ✅ /cekvar, /userid (hanya Thread 1)\n` +
        `• Admin: ✅ Semua command (Thread 1,7,5)\n\n` +
        `<i>Gunakan /bantuan untuk panduan lengkap.</i>`,
        { parse_mode: 'HTML' }
      );
    });
    
  } else if (isNodeTelegramBotApi) {
    // For node-telegram-bot-api - Handler untuk /start dan /scheduler_status
    // HANYA handle command yang spesifik untuk index.js
    
    // Regex untuk command dengan @username support
    const startRegex = new RegExp(`^/start(@${BOT_USERNAME})?$`, 'i');
    const schedulerRegex = new RegExp(`^/scheduler_status(@${BOT_USERNAME})?$`, 'i');
    const reportRevenueRegex = new RegExp(`^/report_revenue(@${BOT_USERNAME})?$`, 'i');
    
    // Handler untuk /start
    bot.onText(startRegex, async (msg) => {
      const userId = msg.from.id.toString();
      const userName = msg.from.first_name || 'Pengguna';
      
      console.log(`🤝 User ${userName} (${userId}) accessed /start command`);
      
      await bot.sendMessage(msg.chat.id,
        `Halo ${userName}! 👋\n\n` +
        `Selamat datang di <b>EatSleepPush GA4 Bot</b>.\n\n` +
        `🤖 <b>Bot ini dapat:</b>\n` +
        `• Mengirim laporan analytics harian\n` +
        `• Menampilkan statistik GA4\n` +
        `• User management & reporting\n\n` +
        `🛠 <b>Status Sistem:</b>\n` +
        `• GA4: ✅ Terhubung\n` +
        `• Scheduler: ✅ Aktif\n` +
        `• Laporan: 12:00 WIB setiap hari\n\n` +
        `📋 <b>Commands untuk Semua User:</b>\n` +
        `/start - Tampilkan pesan ini\n` +
        `/scheduler_status - Cek status scheduler\n\n` +
        `👑 <b>Commands Admin Only:</b>\n` +
        `/report_revenue - Generate laporan revenue\n\n` +
        `🔒 <b>ATURAN AKSES KETAT:</b>\n` +
        `• User tidak terdaftar: ❌ Tidak bisa apa-apa\n` +
        `• User terdaftar: ✅ /cekvar, /userid (hanya Thread 1)\n` +
        `• Admin: ✅ Semua command (Thread 1,7,5)\n\n` +
        `<i>Gunakan /bantuan untuk panduan lengkap.</i>`,
        { parse_mode: 'HTML' }
      );
    });
    
    // Handler untuk /scheduler_status
    bot.onText(schedulerRegex, async (msg) => {
      const userId = msg.from.id.toString();
      const userName = msg.from.first_name || 'Pengguna';
      const threadId = msg.message_thread_id || 0;
      
      console.log(`📊 User ${userName} (${userId}) accessed /scheduler_status in thread ${threadId}`);
      
      const status = botScheduler?.isRunning ? '🟢 BERJALAN' : '🔴 BERHENTI';
      const statusData = botScheduler?.getStatus?.() || {};
      
      let adminInfo = '';
      if (userId === ADMIN_CHAT_ID) {
        adminInfo = `\n👑 <b>Anda adalah Admin</b>\n` +
                   `<b>Command khusus:</b> /report_revenue\n`;
      }
      
      await bot.sendMessage(msg.chat.id,
        `📊 <b>Status Scheduler - EatSleepPush GA4 Bot</b>\n\n` +
        `<b>Halo ${userName}!</b>\n` +
        `${adminInfo}\n` +
        `<b>Status:</b> ${status}\n` +
        `<b>Task Aktif:</b> ${statusData.activeTaskCount || 0}\n` +
        `<b>Laporan Revenue:</b> 12:00 WIB setiap hari\n\n` +
        `<b>Jadwal Berikutnya:</b>\n` +
        `• Revenue Report: ${statusData.nextRevenueReport?.timeOnly || 'N/A'}\n` +
        `• Database Backup: ${statusData.nextBackup?.timeOnly || 'N/A'}\n` +
        `• File Cleanup: ${statusData.nextCleanup?.timeOnly || 'N/A'}\n\n` +
        `<i>System time: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB</i>`,
        { 
          parse_mode: 'HTML',
          ...(threadId && { message_thread_id: threadId })
        }
      );
    });
    
    // Handler untuk /report_revenue (admin only)
    bot.onText(reportRevenueRegex, async (msg) => {
      const userId = msg.from.id.toString();
      const threadId = msg.message_thread_id || 0;
      
      if (userId !== ADMIN_CHAT_ID) {
        await bot.sendMessage(msg.chat.id, 
          '❌ Hanya admin yang bisa menggunakan command ini.',
          { ...(threadId && { message_thread_id: threadId }) }
        );
        return;
      }
      
      await bot.sendMessage(msg.chat.id, 
        '🔄 Memproses laporan revenue harian...',
        { ...(threadId && { message_thread_id: threadId }) }
      );
      
      try {
        if (revenueReporter) {
          await revenueReporter.sendDailyReport();
          await bot.sendMessage(msg.chat.id, 
            '✅ Laporan revenue harian berhasil diproses!',
            { ...(threadId && { message_thread_id: threadId }) }
          );
        } else {
          await bot.sendMessage(msg.chat.id, 
            '❌ Revenue reporter tidak tersedia. Cek log server.',
            { ...(threadId && { message_thread_id: threadId }) }
          );
        }
      } catch (error) {
        await bot.sendMessage(msg.chat.id, 
          `❌ Gagal: ${error.message}`,
          { ...(threadId && { message_thread_id: threadId }) }
        );
      }
    });
  }
  
  // ============================================
  // SIMPLE MESSAGE HANDLER (Forward ke telegram-bot.js)
  // ============================================
  
  // Handler sederhana untuk forward semua ke telegram-bot.js
  // Telegram-bot.js akan handle strict access control
  bot.on('message', async (msg) => {
    // Biarkan telegram-bot.js handle semua dengan strict access control
    // Tidak perlu unknown handler karena unregistered users akan diblok
    const messageText = msg.text || '';
    
    if (messageText && messageText.startsWith('/')) {
      const command = messageText.split(' ')[0].split('@')[0];
      
      // Command yang sudah dihandle di index.js
      const indexJsCommands = ['/start', '/report_revenue', '/scheduler_status'];
      
      // Jika bukan command index.js, biarkan telegram-bot.js handle
      if (!indexJsCommands.includes(command)) {
        console.log(`   ⏩ Command ${command} forwarded to telegram-bot.js strict access control`);
      }
    }
  });
  
  // ============================================
  // WEBHOOK ENDPOINT
  // ============================================
  
  app.post('/telegram-webhook', (req, res) => {
    try {
      // Handle based on bot library
      if (isTelegraf) {
        bot.handleUpdate(req.body);
      } else if (isNodeTelegramBotApi) {
        bot.processUpdate(req.body);
      }
      res.sendStatus(200);
    } catch (error) {
      console.error('❌ Error processing webhook:', error.message);
      res.sendStatus(200); // Always return 200 to Telegram
    }
  });
  
  console.log('✅ Webhook endpoint configured: /telegram-webhook');
  
  // ============================================
  // STARTUP MESSAGE
  // ============================================
  
  // Send startup message after everything is ready
  setTimeout(async () => {
    const startupTime = new Date().toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour12: false
    }).replace(/\./g, ':');
    
    const startupMessage = `🤖 <b>EatSleepPush GA4 Bot v3.0</b>\n\n` +
      `✅ <b>System Startup Complete</b>\n` +
      `🕐 <b>Time:</b> ${startupTime} WIB\n` +
      `👥 <b>Registered Users:</b> ${Object.keys(userDatabase.users).length}\n` +
      `📊 <b>Revenue Reports:</b> 12:00 WIB daily\n` +
      `🔒 <b>Access Control:</b> STRICT ENABLED\n` +
      `⚡ <b>Status:</b> ONLINE\n\n` +
      `<i>Bot ready with strict access control. Unregistered users auto-kick in 30 minutes.</i>`;
    
    // Send to admin
    try {
      if (isTelegraf) {
        await bot.telegram.sendMessage(ADMIN_CHAT_ID, startupMessage, {
          parse_mode: 'HTML'
        });
      } else if (isNodeTelegramBotApi) {
        await bot.sendMessage(ADMIN_CHAT_ID, startupMessage, {
          parse_mode: 'HTML'
        });
      }
      console.log('📨 Startup message sent to admin');
    } catch (error) {
      if (error.code === 403 || error.message.includes('Forbidden') || error.message.includes('bot can\'t initiate conversation')) {
        console.warn('⚠️  Admin belum memulai bot. Pesan startup tidak dikirim.');
        console.warn('   Silakan kirim /start ke bot dari akun admin terlebih dahulu.');
      } else {
        console.error('❌ Failed to send startup message:', error.message);
      }
    }
  }, 15000);
  
}, 100); // Initial timeout

// ============================================
// ADDITIONAL ROUTES
// ============================================

// Health check endpoint
app.get('/health', (req, res) => {
  const userDb = require('./data/user-database');
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'EatSleepPush GA4 Bot',
    version: '3.0.0',
    features: {
      strict_access_control: true,
      auto_kick_unregistered: true,
      kick_delay_minutes: 30,
      revenue_reports: true,
      automatic_scheduling: true,
      user_management: true
    },
    stats: {
      registered_users: Object.keys(userDb.users || {}).length,
      ga4_configured: !!process.env.GA4_PROPERTY_ID,
      admin_configured: !!process.env.ADMIN_CHAT_ID,
      telegram_connected: true,
      scheduler_running: false
    }
  });
});

// Manual report trigger endpoint (untuk testing)
app.get('/trigger-report', async (req, res) => {
  const apiKey = req.query.api_key;
  const validApiKey = process.env.ADMIN_API_KEY || 'test123';
  
  if (apiKey !== validApiKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    // Coba jalankan report manual
    const revenueReporter = require('./services/revenue-reporter');
    const { initializeGA4Client } = require('./services/ga4-client');
    
    const analyticsDataClient = initializeGA4Client();
    const bot = require('./services/telegram-bot').initializeTelegramBot(analyticsDataClient);
    
    const reporter = new revenueReporter(analyticsDataClient, bot);
    await reporter.sendDailyReport();
    
    res.json({ success: true, message: 'Report triggered successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// User statistics endpoint
app.get('/users', (req, res) => {
  const userDb = require('./data/user-database');
  const users = Object.keys(userDb.users || {}).map(id => ({
    id,
    ...userDb.users[id]
  }));
  
  res.json({
    count: users.length,
    users: users
  });
});

// List reports endpoint
app.get('/reports', async (req, res) => {
  try {
    const fs = require('fs').promises;
    const path = require('path');
    const reportsDir = path.join(__dirname, 'reports');
    
    try {
      await fs.access(reportsDir);
      const files = await fs.readdir(reportsDir);
      const htmlFiles = files.filter(f => f.endsWith('.html')).map(f => ({
        name: f,
        path: `/reports/${f}`,
        url: `${req.protocol}://${req.get('host')}/reports/${f}`
      }));
      
      res.json({
        count: htmlFiles.length,
        reports: htmlFiles
      });
    } catch {
      res.json({ count: 0, reports: [], message: 'Reports directory not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve static reports
app.use('/reports', express.static('reports'));

// Simple root endpoint
app.get('/', (req, res) => {
  const userDb = require('./data/user-database');
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>EatSleepPush GA4 Bot</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
        .container { max-width: 1000px; margin: 0 auto; }
        .status { padding: 20px; background: #f0f9ff; border-radius: 8px; margin-bottom: 20px; }
        .card { background: white; padding: 15px; border-radius: 6px; margin: 10px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .menu { display: flex; gap: 10px; margin-top: 20px; flex-wrap: wrap; }
        .menu a { background: #4f46e5; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px; }
        .command-list { background: #f8fafc; padding: 15px; border-radius: 6px; margin: 15px 0; }
        .command { font-family: monospace; background: #e2e8f0; padding: 5px 10px; border-radius: 4px; margin: 5px 0; display: inline-block; }
        .feature-badge { background: #10b981; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; margin-left: 5px; }
        .warning-badge { background: #ef4444; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; margin-left: 5px; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
        .stat-card { background: white; padding: 15px; border-radius: 6px; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🤖 EatSleepPush GA4 Bot v3.0</h1>
        
        <div class="status">
          <h2>System Status</h2>
          <div class="stats-grid">
            <div class="stat-card">
              <h3>👥 Registered Users</h3>
              <p style="font-size: 24px; font-weight: bold;">${Object.keys(userDb.users || {}).length}</p>
            </div>
            <div class="stat-card">
              <h3>🔒 Access Control</h3>
              <p><span class="warning-badge">STRICT</span></p>
              <p>Auto-kick: 30 min</p>
            </div>
            <div class="stat-card">
              <h3>📊 GA4 Status</h3>
              <p>✅ Connected</p>
            </div>
            <div class="stat-card">
              <h3>⏰ Scheduler</h3>
              <p>✅ Active</p>
              <p>12:00 WIB daily</p>
            </div>
          </div>
        </div>
        
        <div class="status">
          <h2>Access Rules <span class="warning-badge">STRICT</span></h2>
          <div class="card">
            <h4>🔴 Unregistered Users:</h4>
            <p>• ❌ Cannot send messages</p>
            <p>• ❌ Cannot use commands</p>
            <p>• ⏰ Auto-kick after 30 minutes</p>
            
            <h4>🟡 Registered Users:</h4>
            <p>• ✅ /cekvar, /userid (Thread 1 only)</p>
            <p>• ✅ Send messages (Thread 1,7,5)</p>
            
            <h4>🟢 Admin:</h4>
            <p>• ✅ All commands (Thread 1,7,5)</p>
            <p>• ✅ Register users with /daftar</p>
          </div>
        </div>
        
        <div class="status">
          <h2>Quick Links</h2>
          <div class="menu">
            <a href="/health">Health Check</a>
            <a href="/users">View Users</a>
            <a href="/reports">View Reports</a>
            <a href="/trigger-report?api_key=test123">Test Report</a>
          </div>
        </div>
      </div>
    </body>
    </html>
  `);
});

// ============================================
// ERROR HANDLING
// ============================================

// Global error handler
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error.message);
  console.error(error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT. Shutting down gracefully...');
  if (typeof botScheduler?.stopAllSchedulers === 'function') {
    botScheduler.stopAllSchedulers();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM. Shutting down gracefully...');
  if (typeof botScheduler?.stopAllSchedulers === 'function') {
    botScheduler.stopAllSchedulers();
  }
  process.exit(0);
});

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 8080;
const server = app.listen(PORT, () => {
  console.log(`🌐 Server bot berjalan di port ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 Webhook: http://localhost:${PORT}/telegram-webhook`);
  console.log(`🔗 Users: http://localhost:${PORT}/users`);
  console.log(`🔗 Reports: http://localhost:${PORT}/reports`);
  console.log(`🤖 Bot Username: @${BOT_USERNAME}`);
  console.log(`🔒 STRICT ACCESS CONTROL: ENABLED (30min auto-kick)`);
});

// Server error handling
server.on('error', (error) => {
  console.error('❌ Server error:', error.message);
  if (error.code === 'EADDRINUSE') {
    console.error(`   Port ${PORT} sudah digunakan!`);
  }
});
