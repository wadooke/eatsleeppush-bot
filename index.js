// index.js - Main application entry point
const express = require('express');
const { initializeTelegramBot } = require('./services/telegram-bot');
const { initializeGA4Client } = require('./services/ga4-client');
const { setupUserDatabase } = require('./data/user-database');
const { loadEnvironment } = require('./config/environment');

// Load environment variables
loadEnvironment();

// Initialize services
const app = express();
app.use(express.json());

// Initialize database
setupUserDatabase();

// Initialize GA4 Client
const analyticsDataClient = initializeGA4Client();

// Initialize Telegram Bot
const bot = initializeTelegramBot(analyticsDataClient);

// Webhook endpoint
app.post('/telegram-webhook', (req, res) => {
  try {
    bot.processUpdate(req.body);
    res.sendStatus(200);
  } catch (error) {
    console.error('Error processing webhook update:', error.message);
    res.sendStatus(200);
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'EatSleepPush GA4 Bot'
  });
});

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🤖 Server bot berjalan di port ${PORT}`);
  console.log(`✅ GA4 Client: ${analyticsDataClient ? 'Ready' : 'Not available'}`);
});
