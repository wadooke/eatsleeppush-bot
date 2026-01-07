// index.js - FULL VERSION dengan Revenue Reporter & Scheduler (DIKOREKSI)
const express = require('express');

// Load environment ONCE
require('dotenv').config();

console.log('[dotenv@17.2.3] injecting env (0) from .env');
console.log('📋 Loading environment configuration...');

const TELEGRAM_GROUP_CHAT_ID = process.env.TELEGRAM_GROUP_CHAT_ID;
const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || '8462501080'; // Default ke ID Anda

console.log('✅ Environment variables loaded successfully');
console.log(`   Group Chat ID: ${TELEGRAM_GROUP_CHAT_ID}`);
console.log(`   GA4 Property ID: ${GA4_PROPERTY_ID}`);
console.log(`   Admin Chat ID: ${ADMIN_CHAT_ID}`);

// Initialize Express
const app = express();
app.use(express.json());

// Initialize database FIRST
console.log('💾 Initializing user database...');
const userDatabase = require('./data/user-database'); // Load database

// Tunggu database selesai load
setTimeout(async () => {
  console.log(`   ✅ Loaded ${Object.keys(userDatabase.users).length} users`);
  console.log(`   Users: [ ${Object.keys(userDatabase.users).join(', ')} ]`);
  
  // Initialize GA4 Client
  console.log('🔧 Initializing GA4 Client...');
  const { initializeGA4Client } = require('./services/ga4-client');
  const analyticsDataClient = initializeGA4Client();
  
  if (!analyticsDataClient) {
    console.error('❌ GA4 Client initialization failed!');
    return;
  }
  
  console.log('✅ GA4 Client initialized successfully');
  
  // Test GA4 connection dengan cara baru
  console.log('🧪 [DIAGNOSTICS] Starting GA4 connection test...');
  console.log(`   Property ID: "${GA4_PROPERTY_ID}"`);
  
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
  // MANUAL COMMANDS FOR ADMIN
  // ============================================
  
  // Determine bot library type
  const isTelegraf = typeof bot.command === 'function';
  const isNodeTelegramBotApi = typeof bot.on === 'function' && typeof bot.sendMessage === 'function';
  
  console.log(`🔧 Bot library detected: ${isTelegraf ? 'Telegraf' : isNodeTelegramBotApi ? 'node-telegram-bot-api' : 'Unknown'}`);
  
  // Add manual commands based on bot library
  if (isTelegraf) {
    // For Telegraf
    bot.command('report_revenue', async (ctx) => {
      const userId = ctx.from.id.toString();
      if (userId !== ADMIN_CHAT_ID) {
        return ctx.reply('❌ Hanya admin yang bisa menggunakan command ini.');
      }
      
      await ctx.reply('🔄 Memproses laporan revenue harian...');
      
      try {
        if (revenueReporter) {
          await revenueReporter.sendDailyReport();
          await ctx.reply('✅ Laporan revenue harian berhasil diproses!');
        } else {
          await ctx.reply('❌ Revenue reporter tidak tersedia. Cek log server.');
        }
      } catch (error) {
        await ctx.reply(`❌ Gagal: ${error.message}`);
      }
    });
    
    bot.command('scheduler_status', async (ctx) => {
      const userId = ctx.from.id.toString();
      if (userId !== ADMIN_CHAT_ID) {
        return ctx.reply('❌ Hanya admin yang bisa menggunakan command ini.');
      }
      
      const status = botScheduler?.isRunning ? '🟢 BERJALAN' : '🔴 BERHENTI';
      const statusData = botScheduler?.getStatus?.() || {};
      
      await ctx.reply(
        `📊 <b>Status Scheduler</b>\n\n` +
        `<b>Status:</b> ${status}\n` +
        `<b>Laporan Revenue:</b> 12:00 WIB setiap hari\n` +
        `<b>Task Aktif:</b> ${statusData.activeTaskCount || 0}\n` +
        `<b>Command Test:</b> /report_revenue\n\n` +
        `<i>System time: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB</i>`,
        { parse_mode: 'HTML' }
      );
    });
    
  } else if (isNodeTelegramBotApi) {
    // For node-telegram-bot-api
    bot.onText(/\/report_revenue/, async (msg) => {
      const userId = msg.from.id.toString();
      if (userId !== ADMIN_CHAT_ID) {
        return bot.sendMessage(msg.chat.id, '❌ Hanya admin yang bisa menggunakan command ini.');
      }
      
      await bot.sendMessage(msg.chat.id, '🔄 Memproses laporan revenue harian...');
      
      try {
        if (revenueReporter) {
          await revenueReporter.sendDailyReport();
          await bot.sendMessage(msg.chat.id, '✅ Laporan revenue harian berhasil diproses!');
        } else {
          await bot.sendMessage(msg.chat.id, '❌ Revenue reporter tidak tersedia. Cek log server.');
        }
      } catch (error) {
        await bot.sendMessage(msg.chat.id, `❌ Gagal: ${error.message}`);
      }
    });
    
    bot.onText(/\/scheduler_status/, async (msg) => {
      const userId = msg.from.id.toString();
      if (userId !== ADMIN_CHAT_ID) {
        return bot.sendMessage(msg.chat.id, '❌ Hanya admin yang bisa menggunakan command ini.');
      }
      
      const status = botScheduler?.isRunning ? '🟢 BERJALAN' : '🔴 BERHENTI';
      const statusData = botScheduler?.getStatus?.() || {};
      
      await bot.sendMessage(msg.chat.id,
        `📊 <b>Status Scheduler</b>\n\n` +
        `<b>Status:</b> ${status}\n` +
        `<b>Laporan Revenue:</b> 12:00 WIB setiap hari\n` +
        `<b>Task Aktif:</b> ${statusData.activeTaskCount || 0}\n` +
        `<b>Command Test:</b> /report_revenue\n\n` +
        `<i>System time: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB</i>`,
        { parse_mode: 'HTML' }
      );
    });
  }
  
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
  // STARTUP MESSAGE DENGAN ERROR HANDLING YANG BAIK
  // ============================================
  
  // Send startup message after everything is ready
  setTimeout(async () => {
    const startupTime = new Date().toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour12: false
    }).replace(/\./g, ':');
    
    const startupMessage = `🤖 <b>EatSleepPush GA4 Bot</b>\n\n` +
      `✅ <b>System Startup Complete</b>\n` +
      `🕐 <b>Time:</b> ${startupTime} WIB\n` +
      `👥 <b>Users:</b> ${Object.keys(userDatabase.users).length}\n` +
      `📊 <b>Revenue Reports:</b> 12:00 WIB daily\n` +
      `⚡ <b>Status:</b> ONLINE\n\n` +
      `<i>Bot ready to process commands.</i>`;
    
    // Send to admin DENGAN ERROR HANDLING YANG BAIK
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
      // Error 403 Forbidden biasanya karena admin belum memulai bot
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

// Health check endpoint (bisa diakses sebelum bot siap)
app.get('/health', (req, res) => {
  const userDb = require('./data/user-database');
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'EatSleepPush GA4 Bot',
    version: '2.0.0',
    features: {
      user_reports: true,
      revenue_reports: true,
      automatic_scheduling: true
    },
    stats: {
      users: Object.keys(userDb.users || {}).length,
      ga4_configured: !!process.env.GA4_PROPERTY_ID,
      admin_configured: !!process.env.ADMIN_CHAT_ID,
      scheduler_running: false // Will be true after initialization
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
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>EatSleepPush GA4 Bot</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
        .container { max-width: 800px; margin: 0 auto; }
        .status { padding: 20px; background: #f0f9ff; border-radius: 8px; margin-bottom: 20px; }
        .card { background: white; padding: 15px; border-radius: 6px; margin: 10px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .menu { display: flex; gap: 10px; margin-top: 20px; }
        .menu a { background: #4f46e5; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🤖 EatSleepPush GA4 Bot</h1>
        
        <div class="status">
          <h2>Status System</h2>
          <div class="card">
            <p><strong>Status:</strong> 🟢 Online</p>
            <p><strong>Service:</strong> Telegram bot for GA4 analytics</p>
            <p><strong>Features:</strong> User reports, Revenue reports, Automatic scheduling</p>
          </div>
        </div>
        
        <div class="status">
          <h2>Quick Links</h2>
          <div class="menu">
            <a href="/health">Health Check</a>
            <a href="/reports">View Reports</a>
            <a href="/trigger-report?api_key=test123">Test Report</a>
          </div>
        </div>
        
        <div class="status">
          <h2>Laporan Otomatis</h2>
          <div class="card">
            <p><strong>Waktu:</strong> Setiap hari jam 12:00 WIB</p>
            <p><strong>Format:</strong> HTML file dikirim ke Telegram</p>
            <p><strong>Status:</strong> Aktif setelah bot startup</p>
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
  // Stop scheduler if exists
  if (typeof botScheduler?.stopAllSchedulers === 'function') {
    botScheduler.stopAllSchedulers();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM. Shutting down gracefully...');
  // Stop scheduler if exists
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
  console.log(`🔗 Reports: http://localhost:${PORT}/reports`);
});

// Server error handling
server.on('error', (error) => {
  console.error('❌ Server error:', error.message);
  if (error.code === 'EADDRINUSE') {
    console.error(`   Port ${PORT} sudah digunakan!`);
  }
});
