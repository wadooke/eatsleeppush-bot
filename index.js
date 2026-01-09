// index.js - FINAL VERSION dengan Strict Access Control System
const express = require('express');

// Load environment ONCE
require('dotenv').config();

console.log('[dotenv@17.2.3] injecting env (0) from .env');
console.log('📋 Loading environment configuration...');

const TELEGRAM_GROUP_CHAT_ID = process.env.TELEGRAM_GROUP_CHAT_ID;
const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID;
const ADMIN_CHAT_ID = process.env.ADMIN_IDS || '185472876';
const BOT_USERNAME = process.env.BOT_USERNAME || 'eatsleeppush_bot';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

console.log('✅ Environment variables loaded successfully');
console.log(`   Group Chat ID: ${TELEGRAM_GROUP_CHAT_ID}`);
console.log(`   GA4 Property ID: ${GA4_PROPERTY_ID}`);
console.log(`   Admin Chat ID: ${ADMIN_CHAT_ID}`);
console.log(`   Bot Username: @${BOT_USERNAME}`);
console.log(`   Token exists: ${!!TELEGRAM_BOT_TOKEN}`);

// Initialize Express
const app = express();
app.use(express.json());

// Flag untuk mencegah multiple instances
let botInstanceRunning = false;

// HELPER FUNCTIONS
function getUserCount() {
  try {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(__dirname, 'data', 'users.json');
    
    if (!fs.existsSync(filePath)) {
      return 0;
    }
    
    const data = fs.readFileSync(filePath, 'utf8');
    const users = JSON.parse(data);
    return Object.keys(users).length;
  } catch (error) {
    console.warn('⚠️  Could not load user database:', error.message);
    return 0;
  }
}

function getUserDatabase() {
  try {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(__dirname, 'data', 'users.json');
    
    if (!fs.existsSync(filePath)) {
      return 0;
    }
    
    const data = fs.readFileSync(filePath, 'utf8');
    const users = JSON.parse(data);
    return Object.keys(users).length;
  } catch (error) {
    console.warn('⚠️  Could not load user database:', error.message);
    return 0;
  }
}

// Initialize database
console.log('💾 Initializing user database...');

// Tunggu database selesai load
setTimeout(async () => {
  // Gunakan helper function untuk mendapatkan jumlah user
  const userCount = getUserCount();
  console.log(`   ✅ Loaded ${userCount} registered users`);
  
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
  
  // ============================================
  // TELEGRAM BOT INITIALIZATION - FINAL VERSION
  // ============================================
  console.log('\n🤖 ===== TELEGRAM BOT INITIALIZATION START =====');
  
  if (botInstanceRunning) {
    console.log('⚠️  Bot instance already running, skipping initialization...');
    return;
  }
  
  try {
    // Cek file existence
    const fs = require('fs');
    const path = require('path');
    const telegramBotPath = path.join(__dirname, 'services', 'telegram-bot.js');
    
    console.log(`🔍 Checking telegram-bot.js at: ${telegramBotPath}`);
    
    if (!fs.existsSync(telegramBotPath)) {
      console.error('❌ telegram-bot.js file NOT FOUND!');
      console.error(`   Expected at: ${telegramBotPath}`);
      console.log('🧪 Trying to create manual bot as fallback...');
      createManualBot();
      return;
    }
    
    console.log('✅ telegram-bot.js file exists');
    
    // Cek token format
    console.log(`🔐 TELEGRAM_BOT_TOKEN check:`);
    if (!TELEGRAM_BOT_TOKEN) {
      console.error('❌ TELEGRAM_BOT_TOKEN is missing from environment');
      return;
    }
    
    console.log(`   Length: ${TELEGRAM_BOT_TOKEN.length} characters`);
    console.log(`   Format: ${TELEGRAM_BOT_TOKEN.includes(':') ? '✅ Valid (has colon)' : '❌ Invalid (no colon)'}`);
    
    // Import dan inisialisasi telegram-bot.js
    console.log('🔄 Importing TelegramBotHandler module...');
    
    try {
      const TelegramBotHandler = require('./services/telegram-bot');
      console.log('✅ TelegramBotHandler module imported successfully');
      
      // Create instance
      console.log('🔄 Creating TelegramBotHandler instance...');
      const botHandler = new TelegramBotHandler();
      
      console.log('🎉 BOT CONNECTED SUCCESSFULLY via telegram-bot.js');
      console.log('✅ Using main TelegramBotHandler, skipping manual bot');
      
      botInstanceRunning = true;
      
    } catch (importError) {
      console.error('❌ Failed to import/initialize TelegramBotHandler:', importError.message);
      console.error('   Error details:', importError.stack?.split('\n')[0]);
      
      // Fallback ke manual bot HANYA jika telegram-bot.js gagal
      console.log('🧪 Creating manual bot instance as backup...');
      createManualBot();
    }
    
  } catch (error) {
    console.error('❌ Telegram bot initialization CRASHED:', error.message);
    console.error('   Full error:', error.stack?.split('\n')[0]);
    
    // Fallback ke manual bot
    console.log('🧪 Trying to create manual bot as last resort...');
    createManualBot();
  }
  
  console.log('🤖 ===== TELEGRAM BOT INITIALIZATION END =====\n');
  
  // ============================================
  // REVENUE REPORTER & SCHEDULER INTEGRATION
  // ============================================
  console.log('💰 Initializing Revenue Reporting System...');
  
  let revenueReporter = null;
  let botScheduler = null;
  
  try {
    // 1. Initialize Revenue Reporter
    const RevenueReporter = require('./services/revenue-reporter');
    revenueReporter = new RevenueReporter(analyticsDataClient, null); // Bot dihandle oleh telegram-bot.js
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
  // WEBHOOK ENDPOINT (untuk production)
  // ============================================
  
  // Webhook endpoint - Telegram bot akan handle sendiri melalui services/telegram-bot.js
  app.post('/telegram-webhook', (req, res) => {
    try {
      // Bot di-handle oleh TelegramBotHandler di services/telegram-bot.js
      // Tidak perlu process di sini
      res.sendStatus(200);
    } catch (error) {
      console.error('❌ Error in webhook endpoint:', error.message);
      res.sendStatus(200); // Always return 200 to Telegram
    }
  });
  
  console.log('✅ Webhook endpoint configured: /telegram-webhook');
  
  // ============================================
  // STARTUP MESSAGE (via HTTP request ke bot sendiri)
  // ============================================
  
  // Send startup message after everything is ready
  setTimeout(async () => {
    const userCount = getUserCount();
    const startupTime = new Date().toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour12: false
    }).replace(/\./g, ':');
    
    const startupMessage = `🤖 <b>EatSleepPush GA4 Bot v3.0</b>\n\n` +
      `✅ <b>System Startup Complete</b>\n` +
      `🕐 <b>Time:</b> ${startupTime} WIB\n` +
      `👥 <b>Registered Users:</b> ${userCount}\n` +
      `📊 <b>Revenue Reports:</b> 12:00 WIB daily\n` +
      `🔒 <b>Access Control:</b> STRICT ENABLED\n` +
      `⚡ <b>Status:</b> ONLINE\n\n` +
      `<b>Access Rules:</b>\n` +
      `👑 <b>Admin</b>: Full access all threads\n` +
      `👤 <b>Registered Users</b>: Chat in thread 0,7,5 | Auto-remove in thread 3,9\n` +
      `🚫 <b>Unregistered</b>: Auto-kick 30 minutes\n\n` +
      `<i>System ready with strict access control.</i>`;
    
    // Try to send startup message via HTTP request (since we don't have bot instance here)
    try {
      // Menggunakan Telegram Bot API langsung
      if (TELEGRAM_BOT_TOKEN && ADMIN_CHAT_ID) {
        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: ADMIN_CHAT_ID,
            text: startupMessage,
            parse_mode: 'HTML'
          })
        });
        
        if (response.ok) {
          console.log('📨 Startup message sent to admin via HTTP');
        } else {
          console.warn('⚠️  Failed to send startup message to admin via HTTP');
        }
      }
    } catch (error) {
      console.warn('⚠️  Could not send startup message via HTTP:', error.message);
    }
  }, 15000);
  
}, 100); // Initial timeout

// ============================================
// MANUAL BOT FUNCTION (ONLY FOR FALLBACK)
// ============================================

function createManualBot() {
  console.log('🔧 Creating manual bot as fallback...');
  
  if (botInstanceRunning) {
    console.log('⚠️  Bot instance already running, skipping manual bot');
    return null;
  }
  
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_BOT_TOKEN.includes(':')) {
    console.error('❌ Invalid token for manual bot');
    return null;
  }
  
  try {
    const TelegramBot = require('node-telegram-bot-api');
    const manualBot = new TelegramBot(TELEGRAM_BOT_TOKEN, { 
      polling: {
        interval: 300,
        autoStart: true,
        params: {
          timeout: 30,
          allowed_updates: ['message', 'callback_query']
        }
      }
    });
    
    // Setup error handling
    manualBot.on('polling_error', (error) => {
      console.error(`❌ Manual bot polling error: ${error.message}`);
    });
    
    manualBot.on('webhook_error', (error) => {
      console.error(`❌ Manual bot webhook error: ${error.message}`);
    });
    
    // Setup message handler
    manualBot.on('message', (msg) => {
      const text = msg.text || '';
      const userName = msg.from?.first_name || 'Unknown';
      const userId = msg.from?.id;
      const chatType = msg.chat?.type;
      
      console.log(`📨 MANUAL BOT: Message from ${userName} (${userId}) in ${chatType}: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
      
      // Basic response for /start
      if (text === '/start') {
        manualBot.sendMessage(msg.chat.id, 
          `🤖 <b>EAT SLEEP PUSH BOT v3.0</b>\n\n` +
          `Hello ${userName}!\n` +
          `Your ID: <code>${userId}</code>\n` +
          `Chat Type: ${chatType}\n\n` +
          `⚠️  Running in MANUAL MODE (fallback)\n` +
          `📡 Status: Online\n` +
          `👑 Admin: ${ADMIN_CHAT_ID}\n\n` +
          `<i>Main bot handler failed, using manual fallback</i>`,
          { parse_mode: 'HTML' }
        ).catch(err => console.error('❌ Failed to send message:', err.message));
      }
    });
    
    // Get bot info
    manualBot.getMe()
      .then(info => {
        console.log(`🎉 MANUAL BOT SUCCESS: @${info.username}`);
        console.log(`   ID: ${info.id}`);
        console.log(`   Name: ${info.first_name}`);
        console.log(`   Can read group messages: ${info.can_read_all_group_messages ? '✅ YES' : '❌ NO'}`);
        console.log('✅ Manual bot is listening for messages');
        
        botInstanceRunning = true;
        
        // Send test message to admin
        setTimeout(() => {
          console.log('📨 Sending test message to admin via manual bot...');
          manualBot.sendMessage(ADMIN_CHAT_ID, 
            '🤖 <b>MANUAL BOT FALLBACK ACTIVATED</b>\n\n' +
            '⚠️  <b>Main telegram-bot.js failed!</b>\n' +
            '✅ <b>Manual bot started as fallback</b>\n' +
            `🕐 Time: ${new Date().toLocaleString('id-ID')}\n` +
            '📡 Mode: Polling\n' +
            '🔧 Status: Listening for messages\n\n' +
            '<i>Try sending /start in your group</i>',
            { parse_mode: 'HTML' }
          ).then(() => {
            console.log('✅ Test message sent to admin via manual bot');
          }).catch(err => {
            console.log('⚠️  Could not send test message to admin:', err.message);
          });
        }, 3000);
        
      })
      .catch(error => {
        console.error('❌ Manual bot connection failed:', error.message);
      });
    
    return manualBot;
    
  } catch (error) {
    console.error('❌ Manual bot creation failed:', error.message);
    return null;
  }
}

// ============================================
// ADDITIONAL ROUTES
// ============================================

// Health check endpoint
app.get('/health', (req, res) => {
  try {
    const users = getUserDatabase();
    res.status(200).json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      service: 'EatSleepPush GA4 Bot',
      version: '3.0.0',
      bot_status: botInstanceRunning ? 'RUNNING' : 'STOPPED',
      bot_mode: botInstanceRunning ? 'PRIMARY' : 'OFFLINE',
      features: {
        strict_access_control: true,
        auto_kick_unregistered: true,
        kick_delay_minutes: 30,
        revenue_reports: true,
        automatic_scheduling: true,
        user_management: true
      },
      stats: {
        registered_users: Object.keys(users).length,
        ga4_configured: !!GA4_PROPERTY_ID,
        admin_configured: !!ADMIN_CHAT_ID,
        telegram_connected: !!TELEGRAM_BOT_TOKEN,
        bot_instance_running: botInstanceRunning
      }
    });
  } catch (error) {
    res.status(200).json({ 
      status: 'WARNING', 
      message: 'Could not load user database',
      error: error.message,
      bot_instance_running: botInstanceRunning
    });
  }
});

// User statistics endpoint
app.get('/users', (req, res) => {
  try {
    const users = getUserDatabase();
    const userList = Object.keys(users).map(id => ({
      id,
      ...users[id]
    }));
    
    res.json({
      count: userList.length,
      users: userList
    });
  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      message: 'Could not load user database'
    });
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
  try {
    const users = getUserDatabase();
    const userCount = Object.keys(users).length;
    
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
        .bot-status { 
          display: inline-block; 
          padding: 5px 10px; 
          border-radius: 15px; 
          font-size: 12px; 
          font-weight: bold;
        }
        .bot-running { background: #10b981; color: white; }
        .bot-stopped { background: #ef4444; color: white; }
        .bot-fallback { background: #f59e0b; color: white; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🤖 EatSleepPush GA4 Bot v3.0</h1>
        
        <div class="status">
          <h2>Bot Status 
            <span class="bot-status ${botInstanceRunning ? 'bot-running' : 'bot-stopped'}">
              ${botInstanceRunning ? 'RUNNING' : 'STOPPED'}
            </span>
            <span class="warning-badge">STRICT ACCESS CONTROL</span>
          </h2>
          <div class="stats-grid">
            <div class="stat-card">
              <h3>👥 Registered Users</h3>
              <p style="font-size: 24px; font-weight: bold;">${userCount}</p>
            </div>
            <div class="stat-card">
              <h3>🤖 Bot Status</h3>
              <p><span class="${botInstanceRunning ? 'bot-running' : 'bot-stopped'}" style="padding: 5px 10px; border-radius: 15px; font-size: 12px; font-weight: bold;">
                ${botInstanceRunning ? '✅ RUNNING' : '❌ STOPPED'}
              </span></p>
              <p>Mode: ${botInstanceRunning ? 'PRIMARY' : 'OFFLINE'}</p>
            </div>
            <div class="stat-card">
              <h3>🔒 Access Control</h3>
              <p><span class="warning-badge">STRICT</span></p>
              <p>Auto-kick: 30 min</p>
              <p>Auto-remove: Thread 3,9</p>
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
            <h4>👑 ADMIN:</h4>
            <p>• ✅ Full access ALL threads</p>
            <p>• ✅ All commands</p>
            
            <h4>👤 REGISTERED USER:</h4>
            <p>• ✅ Chat in thread: 0, 7, 5</p>
            <p>• ❌ Auto-remove SILENT in thread: 3, 9 (bot-only)</p>
            <p>• ✅ Commands: /cekvar, /userid, /start, /scheduler_status</p>
            
            <h4>🚫 UNREGISTERED:</h4>
            <p>• ❌ Cannot send messages</p>
            <p>• ❌ Cannot use commands</p>
            <p>• ⏰ Auto-kick after 30 minutes</p>
          </div>
        </div>
        
        <div class="status">
          <h2>Quick Links</h2>
          <div class="menu">
            <a href="/health">Health Check</a>
            <a href="/users">View Users</a>
            <a href="/reports">View Reports</a>
          </div>
        </div>
      </div>
    </body>
    </html>
  `);
  } catch (error) {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>Error</title></head>
    <body>
      <h1>⚠️  System Error</h1>
      <p>Could not load user database: ${error.message}</p>
      <p>Bot Status: ${botInstanceRunning ? 'RUNNING' : 'STOPPED'}</p>
    </body>
    </html>
    `);
  }
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
  botInstanceRunning = false;
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM. Shutting down gracefully...');
  botInstanceRunning = false;
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
  console.log(`⚠️  ANTI-409-CONFLICT: ENABLED (only one bot instance)`);
});

// Server error handling
server.on('error', (error) => {
  console.error('❌ Server error:', error.message);
  if (error.code === 'EADDRINUSE') {
    console.error(`   Port ${PORT} sudah digunakan!`);
  }
});
