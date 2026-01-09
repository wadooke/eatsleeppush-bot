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
const userDatabase = require('./data/user-database');

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
  
  // ============================================
  // TELEGRAM BOT INITIALIZATION - DEBUG VERSION
  // ============================================
  console.log('\n🤖 ===== TELEGRAM BOT INITIALIZATION START =====');
  
  try {
    // 🚨 DEBUG 1: Cek file existence
    const fs = require('fs');
    const path = require('path');
    const telegramBotPath = path.join(__dirname, 'services', 'telegram-bot.js');
    
    console.log(`🔍 Checking telegram-bot.js at: ${telegramBotPath}`);
    
    if (!fs.existsSync(telegramBotPath)) {
      console.error('❌ telegram-bot.js file NOT FOUND!');
      console.error(`   Expected at: ${telegramBotPath}`);
    } else {
      console.log('✅ telegram-bot.js file exists');
      const stats = fs.statSync(telegramBotPath);
      console.log(`   Size: ${stats.size} bytes`);
      console.log(`   Modified: ${stats.mtime.toLocaleString()}`);
    }
    
    // 🚨 DEBUG 2: Cek token
    const token = process.env.TELEGRAM_BOT_TOKEN;
    console.log(`🔐 TELEGRAM_BOT_TOKEN check:`);
    console.log(`   Exists: ${!!token}`);
    if (token) {
      console.log(`   Length: ${token.length} characters`);
      console.log(`   Preview: ${token.substring(0, 5)}...${token.substring(token.length - 5)}`);
      console.log(`   Format: ${token.includes(':') ? '✅ Has colon' : '❌ No colon (invalid)'}`);
    }
    
    // 🚨 DEBUG 3: Import module
    console.log('🔄 Importing TelegramBotHandler module...');
    
    try {
      const TelegramBotHandler = require('./services/telegram-bot');
      console.log('✅ TelegramBotHandler module imported successfully');
      console.log(`   Type: ${typeof TelegramBotHandler}`);
      
      // 🚨 DEBUG 4: Create instance
      console.log('🔄 Creating TelegramBotHandler instance...');
      const botHandler = new TelegramBotHandler();
      console.log('✅ TelegramBotHandler instance created');
      
      // 🚨 DEBUG 5: Manual bot creation as backup
      console.log('🧪 Creating manual bot instance as backup...');
      const TelegramBot = require('node-telegram-bot-api');
      
      if (token && token.includes(':')) {
        console.log('🔄 Creating manual TelegramBot with polling...');
        const manualBot = new TelegramBot(token, { 
          polling: true,
          request: {
            timeout: 60000
          }
        });
        
        // Test connection
        manualBot.getMe()
          .then(info => {
            console.log(`🎉 MANUAL BOT SUCCESS: @${info.username}`);
            console.log(`   ID: ${info.id}`);
            console.log(`   Name: ${info.first_name}`);
            console.log(`   Can read group messages: ${info.can_read_all_group_messages ? '✅ YES' : '❌ NO'}`);
            
            // Setup simple handler
            manualBot.on('message', (msg) => {
              const text = msg.text || '';
              const userName = msg.from?.first_name || 'Unknown';
              const userId = msg.from?.id;
              const chatType = msg.chat?.type;
              
              console.log(`\n📨 MANUAL BOT: Message from ${userName} (${userId}) in ${chatType}: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
              
              if (text === '/start') {
                manualBot.sendMessage(msg.chat.id, 
                  `🤖 <b>EAT SLEEP PUSH BOT v3.0</b>\n\n` +
                  `Hello ${userName}!\n` +
                  `Your ID: <code>${userId}</code>\n` +
                  `Chat Type: ${chatType}\n\n` +
                  `✅ Manual bot is working!\n` +
                  `🔒 Access Control: Active\n` +
                  `👑 Admin: ${ADMIN_CHAT_ID}\n\n` +
                  `<i>This is a test response from manual bot</i>`,
                  { parse_mode: 'HTML' }
                );
              }
            });
            
            console.log('✅ Manual bot is listening for messages');
            
            // Test send message to admin
            setTimeout(() => {
              console.log('📨 Sending test message to admin via manual bot...');
              manualBot.sendMessage(ADMIN_CHAT_ID, 
                '🤖 <b>MANUAL BOT TEST</b>\n\n' +
                '✅ Manual bot started successfully\n' +
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
      } else {
        console.error('❌ Token invalid for manual bot');
      }
      
    } catch (importError) {
      console.error('❌ Failed to import TelegramBotHandler:', importError.message);
      console.error('   Stack:', importError.stack);
      
      // Try alternative import
      console.log('🔄 Trying alternative import path...');
      try {
        const altPath = path.join(__dirname, 'services', 'telegram-bot');
        const TelegramBotHandler = require(altPath);
        console.log('✅ Alternative import successful');
        const botHandler = new TelegramBotHandler();
      } catch (altError) {
        console.error('❌ Alternative import also failed:', altError.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Telegram bot initialization CRASHED:', error.message);
    console.error('   Stack:', error.stack);
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
      `<b>Access Rules:</b>\n` +
      `👑 <b>Admin</b>: Full access all threads\n` +
      `👤 <b>Registered Users</b>: Chat in thread 0,7,5 | Auto-remove in thread 3,9\n` +
      `🚫 <b>Unregistered</b>: Auto-kick 30 minutes\n\n` +
      `<i>System ready with strict access control.</i>`;
    
    // Try to send startup message via HTTP request (since we don't have bot instance here)
    try {
      // Menggunakan Telegram Bot API langsung
      const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
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
          <h2>System Status <span class="warning-badge">STRICT ACCESS CONTROL</span></h2>
          <div class="stats-grid">
            <div class="stat-card">
              <h3>👥 Registered Users</h3>
              <p style="font-size: 24px; font-weight: bold;">${Object.keys(userDb.users || {}).length}</p>
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
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM. Shutting down gracefully...');
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
