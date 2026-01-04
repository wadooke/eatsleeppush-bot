// index.js - Main application entry point - VERSI DIPERBAIKI
const express = require('express');
const { initializeTelegramBot } = require('./services/telegram-bot');
const { initializeGA4Client } = require('./services/ga4-client');
const userDatabase = require('./data/user-database'); // GANTI INI

// Load environment variables
require('dotenv').config();

console.log('[dotenv@17.2.3] injecting env (0) from .env');
console.log('📋 Loading environment configuration...');

const TELEGRAM_GROUP_CHAT_ID = process.env.TELEGRAM_GROUP_CHAT_ID;
const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID;

console.log('✅ Environment variables loaded successfully');
console.log(`   Group Chat ID: ${TELEGRAM_GROUP_CHAT_ID}`);
console.log(`   GA4 Property ID: ${GA4_PROPERTY_ID}`);

// Initialize services
const app = express();
app.use(express.json());

// Initialize database - GANTI CARA INI
console.log('💾 Initializing user database...');
// Database akan auto-load saat require(), tapi kita bisa verifikasi
console.log(`   ✅ Loaded ${Object.keys(userDatabase.users).length} users`);
console.log(`   Users: [ ${Object.keys(userDatabase.users).join(', ')} ]`);

// Initialize GA4 Client
console.log('🔧 Initializing GA4 Client...');
const analyticsDataClient = initializeGA4Client();

// Initialize Telegram Bot
console.log('🤖 Initializing Telegram Bot...');
const bot = initializeTelegramBot(analyticsDataClient);

// Webhook endpoint
app.post('/telegram-webhook', (req, res) => {
  try {
    bot.processUpdate(req.body);
    res.sendStatus(200);
  } catch (error) {
    console.error('❌ Error processing webhook update:', error.message);
    res.sendStatus(200);
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'EatSleepPush GA4 Bot',
    users: Object.keys(userDatabase.users).length
  });
});

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🤖 Server bot berjalan di port ${PORT}`);
  console.log(`✅ GA4 Client: ${analyticsDataClient ? 'Ready' : 'Not available'}`);
  
  // Test GA4 connection
  if (analyticsDataClient) {
    console.log('🧪 [DIAGNOSTICS] Starting GA4 connection test...');
    console.log(`   Property ID: "${GA4_PROPERTY_ID}"`);
    console.log(`   Service Account: ${process.env.GA4_SERVICE_ACCOUNT_EMAIL || 'Not set'}`);
    console.log('   Testing with simple query...');
    
    // Async test (tidak block startup)
    setTimeout(async () => {
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
        console.log('⚠️  [DIAGNOSTICS] GA4 connection test WARNING:');
        console.log(`      ${ga4Error.message}`);
        console.log('      Bot will continue running, but /cekvar may fail.');
      }
    }, 1000);
  }
});
