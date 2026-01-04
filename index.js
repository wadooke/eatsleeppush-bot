// index.js - FIX VERSION (HAPUS DUPLIKASI)
const express = require('express');

// Load environment ONCE
require('dotenv').config();

console.log('[dotenv@17.2.3] injecting env (0) from .env');
console.log('📋 Loading environment configuration...');

const TELEGRAM_GROUP_CHAT_ID = process.env.TELEGRAM_GROUP_CHAT_ID;
const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID;

console.log('✅ Environment variables loaded successfully');
console.log(`   Group Chat ID: ${TELEGRAM_GROUP_CHAT_ID}`);
console.log(`   GA4 Property ID: ${GA4_PROPERTY_ID}`);

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
  
  if (analyticsDataClient) {
    console.log('✅ GA4 Client initialized successfully');
    
    // Test GA4 connection
    console.log('🧪 [DIAGNOSTICS] Starting GA4 connection test...');
    console.log(`   Property ID: "${GA4_PROPERTY_ID}"`);
    console.log(`   Service Account: ${process.env.GA4_SERVICE_ACCOUNT_EMAIL || 'Not set'}`);
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
    }
    
    // Initialize Telegram Bot
    console.log('🤖 Initializing Telegram Bot...');
    const { initializeTelegramBot } = require('./services/telegram-bot');
    const bot = initializeTelegramBot(analyticsDataClient);
    
    if (bot) {
      // Webhook endpoint
      app.post('/telegram-webhook', (req, res) => {
        try {
          bot.processUpdate(req.body);
          res.sendStatus(200);
        } catch (error) {
          console.error('❌ Error processing webhook:', error.message);
          res.sendStatus(200);
        }
      });
      
      console.log('✅ Telegram Bot initialized');
    }
  }
}, 100);

// Health check endpoint (bisa diakses sebelum bot siap)
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'EatSleepPush GA4 Bot',
    users: Object.keys(userDatabase.users || {}).length,
    ga4: !!process.env.GA4_PROPERTY_ID
  });
});

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🤖 Server bot berjalan di port ${PORT}`);
});
