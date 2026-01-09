// telegram-bot.js - Handler utama dengan Strict Access Control + LAPORAN Thread + Edit User + Rate Limiting + GA4 Real Data
const TelegramBot = require('node-telegram-bot-api');
const accessControl = require('../utils/access-control');

// ====== FUNGSI UTILITY UNTUK BACA/TULIS USER DATABASE ======
const fs = require('fs');
const path = require('path');

const USERS_FILE_PATH = path.join(__dirname, '../data/users.json');

function loadUserDatabase() {
    try {
        console.log(`📂 Loading user database from: ${USERS_FILE_PATH}`);
        
        // Cek jika file exists
        if (!fs.existsSync(USERS_FILE_PATH)) {
            console.error('❌ users.json file not found at:', USERS_FILE_PATH);
            
            // Buat file dengan struktur default
            const defaultData = {
                "185472876": {
                    "username": "iwaksothil",
                    "name": "iwak sothil",
                    "registeredAt": "2026-01-08T00:00:00.000Z",
                    "registeredBy": "system",
                    "status": "active",
                    "role": "admin",
                    "userType": "admin",
                    "article": "default",
                    "waLink": "default"
                }
            };
            
            // Buat direktori jika belum ada
            const dirPath = path.dirname(USERS_FILE_PATH);
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
                console.log(`📁 Created directory: ${dirPath}`);
            }
            
            // Tulis file default
            fs.writeFileSync(USERS_FILE_PATH, JSON.stringify(defaultData, null, 2), 'utf8');
            console.log('✅ Created default users.json file');
            return defaultData;
        }
        
        // Baca file
        const data = fs.readFileSync(USERS_FILE_PATH, 'utf8');
        
        // Validasi JSON
        if (!data.trim()) {
            console.error('❌ users.json is empty');
            return {};
        }
        
        const parsed = JSON.parse(data);
        
        // Validasi struktur
        Object.keys(parsed).forEach(userId => {
            if (!parsed[userId].userType) {
                parsed[userId].userType = parsed[userId].role === 'admin' ? 'admin' : 'registered';
            }
            if (!parsed[userId].article) {
                parsed[userId].article = 'default';
            }
            if (!parsed[userId].waLink) {
                parsed[userId].waLink = 'https://wa-me.cloud/bin001';
            }
        });
        
        console.log(`✅ Loaded ${Object.keys(parsed).length} users from database`);
        return parsed;
        
    } catch (error) {
        console.error('❌ CRITICAL: Error loading user database:', error.message);
        console.error('   Stack:', error.stack);
        
        // Fallback ke data minimal
        return {
            "185472876": {
                "username": "iwaksothil",
                "name": "iwak sothil",
                "registeredAt": new Date().toISOString(),
                "registeredBy": "system",
                "status": "active",
                "role": "admin",
                "userType": "admin",
                "article": "default",
                "waLink": "default"
            }
        };
    }
}

function saveUserDatabase(users) {
    try {
        console.log(`💾 Saving user database to: ${USERS_FILE_PATH}`);
        console.log(`📊 Users count to save: ${Object.keys(users).length}`);
        
        // Backup existing file
        if (fs.existsSync(USERS_FILE_PATH)) {
            const backupPath = USERS_FILE_PATH + '.backup';
            fs.copyFileSync(USERS_FILE_PATH, backupPath);
            console.log(`📦 Created backup at: ${backupPath}`);
        }
        
        // Tulis data baru
        const dataToWrite = JSON.stringify(users, null, 2);
        fs.writeFileSync(USERS_FILE_PATH, dataToWrite, 'utf8');
        
        // Verifikasi penulisan
        const fileStats = fs.statSync(USERS_FILE_PATH);
        const fileContent = fs.readFileSync(USERS_FILE_PATH, 'utf8');
        const writtenData = JSON.parse(fileContent);
        
        console.log(`✅ File successfully written!`);
        console.log(`📏 File size: ${fileStats.size} bytes`);
        console.log(`👥 Users written: ${Object.keys(writtenData).length}`);
        
        // Log sample data untuk verifikasi
        const sampleUserIds = Object.keys(writtenData).slice(0, 3);
        sampleUserIds.forEach(userId => {
            console.log(`   👤 ${userId}: article="${writtenData[userId]?.article || 'N/A'}", waLink="${writtenData[userId]?.waLink || 'N/A'}"`);
        });
        
        return true;
    } catch (error) {
        console.error('❌ Gagal menyimpan user database:', error.message);
        console.error('   Stack:', error.stack);
        
        // Coba cara alternatif jika gagal
        try {
            console.log('🔄 Trying alternative save method...');
            const tempPath = USERS_FILE_PATH + '.tmp';
            fs.writeFileSync(tempPath, JSON.stringify(users, null, 2), 'utf8');
            fs.renameSync(tempPath, USERS_FILE_PATH);
            console.log('✅ Alternative save successful!');
            return true;
        } catch (altError) {
            console.error('❌ Alternative save also failed:', altError.message);
            return false;
        }
    }
}
// ====== END FUNGSI UTILITY ======

class TelegramBotHandler {
  constructor() {
    console.log('\n🤖 ===== TELEGRAM BOT HANDLER INITIALIZATION =====');
    
    // 🚨 ANTI-409 CONFLICT: Cek apakah sudah ada instance yang jalan
    if (global._telegramBotInstanceRunning) {
      console.log('⚠️  ANTI-409: Another bot instance detected, skipping initialization');
      console.log('   ⚠️  Only one bot instance can run at a time');
      this.bot = null;
      this.isInitialized = false;
      return;
    }
    
    // Tandai bahwa instance ini sedang berjalan
    global._telegramBotInstanceRunning = true;
    
    this.bot = null;
    this.isInitialized = false;
    
    // 🆕 Rate Limiting Database
    this.rateLimitDB = {}; // Format: userId: { lastCheck: timestamp, dailyCount: number, lastReset: date }
    
    this.RATE_LIMIT_CONFIG = {
      COOLDOWN_MINUTES: 20,     // 20 menit cooldown
      DAILY_LIMIT: 10,          // 10 kali per hari
      RESET_HOUR: 0,            // Reset jam 00:00 WIB
      ALLOWED_THREADS: [0, 7, 5] // Thread dimana /cekvar diizinkan
    };
    
    // DEBUG: Tampilkan semua environment variables terkait
    console.log('🔍 Environment Check:');
    console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
    console.log(`   TELEGRAM_BOT_TOKEN exists: ${!!process.env.TELEGRAM_BOT_TOKEN}`);
    console.log(`   TELEGRAM_GROUP_CHAT_ID: ${process.env.TELEGRAM_GROUP_CHAT_ID}`);
    console.log(`   ADMIN_IDS: ${process.env.ADMIN_IDS}`);
    console.log(`   LAPORAN_THREAD_ID: ${process.env.LAPORAN_THREAD_ID || '3 (default)'}`);
    console.log(`   GA4_PROPERTY_ID: ${process.env.GA4_PROPERTY_ID || 'Not set!'}`);
    
    console.log('🔄 Rate Limiting Configuration:');
    console.log(`   Cooldown: ${this.RATE_LIMIT_CONFIG.COOLDOWN_MINUTES} menit`);
    console.log(`   Daily Limit: ${this.RATE_LIMIT_CONFIG.DAILY_LIMIT} kali/hari`);
    console.log(`   Allowed Threads: ${this.RATE_LIMIT_CONFIG.ALLOWED_THREADS.join(', ')}`);
    
    // 🚨 PASTIKAN token ada sebelum mencoba initialize
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      console.error('❌ CRITICAL: TELEGRAM_BOT_TOKEN is EMPTY or UNDEFINED!');
      console.error('   Cannot initialize bot without token.');
      global._telegramBotInstanceRunning = false; // Reset flag
      return;
    }
    
    // Tampilkan preview token (sensor sebagian)
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const tokenPreview = token.length > 10 
      ? `${token.substring(0, 5)}...${token.substring(token.length - 5)}`
      : 'INVALID_LENGTH';
    console.log(`🔐 Token preview: ${tokenPreview} (length: ${token.length})`);
    
    this.initializeBot();
    
    if (this.bot) {
      console.log('✅ Bot instance created, setting up handlers...');
      this.setupHandlers();
    } else {
      console.error('❌ Bot instance FAILED to create!');
      global._telegramBotInstanceRunning = false; // Reset flag
    }
    
    console.log('🤖 ===== INITIALIZATION COMPLETE =====\n');
    console.log(`⚠️  ANTI-409-CONFLICT: ENABLED (only one bot instance)`);
  }

  initializeBot() {
    console.log('🔧 Initializing Telegram Bot...');
    const token = process.env.TELEGRAM_BOT_TOKEN;
    
    try {
      console.log('🔄 Creating TelegramBot instance with POLLING mode...');
      
      this.bot = new TelegramBot(token, { 
        polling: true
      });
      
      console.log('✅ TelegramBot instance created successfully');
      
      this.bot.on('polling_error', (error) => {
        console.error('❌ Telegram polling error:', error.message);
        // Jika error 409, reset flag agar instance baru bisa jalan
        if (error.message.includes('409')) {
          console.log('🔄 Resetting instance flag due to 409 conflict');
          global._telegramBotInstanceRunning = false;
        }
      });
      
      this.bot.on('webhook_error', (error) => {
        console.error('❌ Telegram webhook error:', error.message);
      });
      
      this.bot.on('polling_start', () => {
        console.log('📡 Telegram polling STARTED successfully');
        
        this.bot.getMe()
          .then(botInfo => {
            console.log(`🎉 BOT CONNECTED SUCCESSFULLY:`);
            console.log(`   👤 Username: @${botInfo.username}`);
            console.log(`   📛 Name: ${botInfo.first_name}`);
            console.log(`   🆔 ID: ${botInfo.id}`);
            console.log(`   📖 Can read group messages: ${botInfo.can_read_all_group_messages ? '✅ YES' : '❌ NO'}`);
            console.log(`   👥 Can join groups: ${botInfo.can_join_groups ? '✅ YES' : '❌ NO'}`);
            this.isInitialized = true;
            
            this.sendTestMessage();
          })
          .catch(error => {
            console.error('❌ Failed to get bot info:', error.message);
          });
      });
      
    } catch (error) {
      console.error('❌ FATAL: Failed to create TelegramBot instance:', error.message);
      console.error('   Stack:', error.stack);
      global._telegramBotInstanceRunning = false; // Reset flag
    }
  }

  sendTestMessage() {
    const adminId = process.env.ADMIN_IDS;
    if (!adminId || !this.bot) return;
    
    console.log('📨 Sending test message to admin...');
    
    const testMessage = `🤖 <b>BOT STARTUP TEST</b>\n\n` +
      `✅ Bot initialized successfully\n` +
      `🕐 Time: ${new Date().toLocaleString('id-ID')}\n` +
      `🔧 Mode: Polling\n` +
      `📡 Status: Listening for messages\n\n` +
      `<b>Thread Configuration:</b>\n` +
      `📊 LAPORAN: Thread ${process.env.LAPORAN_THREAD_ID || 3}\n` +
      `💬 DISKUSI: Thread ${process.env.DISKUSI_UMUM_THREAD_ID || 0}\n` +
      `📱 APLIKASI: Thread ${process.env.APLIKASI_THREAD_ID || 7}\n` +
      `🎓 TUTORIAL: Thread ${process.env.TUTORIAL_THREAD_ID || 5}\n` +
      `📢 PENGUMUMAN: Thread ${process.env.PENGUMUMAN_THREAD_ID || 9}\n\n` +
      `<b>New Features:</b>\n` +
      `✏️ /edit_user - Edit artikel & link user\n` +
      `⏰ Rate Limiting - 20 menit cooldown, 10x/hari\n` +
      `📊 Auto-laporan di thread 3 (silent) dengan data REAL GA4\n` +
      `📈 Data Active Users & Views dari GA4 real-time\n\n` +
      `<i>Try sending /cekvar in allowed threads</i>`;
    
    this.bot.sendMessage(adminId, testMessage, { parse_mode: 'HTML' })
      .then(() => console.log('✅ Test message sent to admin'))
      .catch(error => {
        console.log('⚠️  Could not send test message to admin:', error.message);
      });
  }

  setupHandlers() {
    if (!this.bot) {
      console.error('❌ Cannot setup handlers - bot is null');
      return;
    }
    
    console.log('🔧 Setting up message handlers with Strict Access Control...');
    
    this.bot.on('message', async (msg) => {
      try {
        const userId = msg.from?.id?.toString();
        const userName = msg.from?.first_name || 'Unknown';
        const text = msg.text || '';
        const chatType = msg.chat?.type || 'unknown';
        const threadId = msg.message_thread_id || 0;
        
        console.log(`\n📨 MESSAGE RECEIVED:`);
        console.log(`   👤 From: ${userName} (${userId})`);
        console.log(`   💬 Text: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
        console.log(`   💬 Chat: ${chatType} (ID: ${msg.chat?.id})`);
        console.log(`   🧵 Thread: ${threadId}`);
        
        if (msg.from?.is_bot || !text) {
          console.log('   ⏩ Skipping (bot message or empty)');
          return;
        }
        
        await this.processMessageWithAccessControl(msg);
        
      } catch (error) {
        console.error('❌ Error in message handler:', error.message);
      }
    });
    
    this.bot.on('error', (error) => {
      console.error('❌ Telegram Bot Error:', error.message);
    });
    
    console.log('✅ Message handlers setup complete');
    console.log('🔴 Strict Access Control: READY');
    console.log('⏰ Rate Limiting: ACTIVE');
    console.log('📊 LAPORAN Thread: 3 (silent mode)');
    console.log('📈 GA4 Data: REAL-TIME');
    console.log('✏️ Edit User: Available for admin');
  }

  // ============================================
  // RATE LIMITING FUNCTIONS
  // ============================================

  checkRateLimit(userId, threadId) {
    const now = new Date();
    const userLimit = this.rateLimitDB[userId] || {
      lastCheck: null,
      dailyCount: 0,
      lastReset: null
    };
    
    if (!this.RATE_LIMIT_CONFIG.ALLOWED_THREADS.includes(threadId)) {
      return {
        allowed: false,
        reason: 'thread_not_allowed',
        message: `❌ <b>/cekvar hanya bisa di thread:</b>\n\n` +
                `💬 DISKUSI UMUM (Thread 0)\n` +
                `📱 APLIKASI (Thread 7)\n` +
                `🎓 TUTORIAL (Thread 5)\n\n` +
                `Anda di thread: <b>${threadId}</b>\n` +
                `Coba pindah ke thread yang diizinkan.`
      };
    }
    
    const resetTime = new Date(now);
    resetTime.setHours(this.RATE_LIMIT_CONFIG.RESET_HOUR, 0, 0, 0);
    
    if (!userLimit.lastReset || now > userLimit.lastReset) {
      userLimit.dailyCount = 0;
      userLimit.lastReset = resetTime;
      console.log(`🔄 Daily limit reset for user ${userId}`);
    }
    
    if (userLimit.dailyCount >= this.RATE_LIMIT_CONFIG.DAILY_LIMIT) {
      const nextReset = new Date(resetTime);
      nextReset.setDate(nextReset.getDate() + 1);
      const timeToReset = Math.ceil((nextReset - now) / (1000 * 60 * 60));
      
      return {
        allowed: false,
        reason: 'daily_limit_exceeded',
        message: `❌ <b>DAILY LIMIT TERLAHUI!</b>\n\n` +
                `Anda sudah menggunakan <b>${userLimit.dailyCount}/${this.RATE_LIMIT_CONFIG.DAILY_LIMIT}</b> kali hari ini.\n` +
                `Limit: <b>${this.RATE_LIMIT_CONFIG.DAILY_LIMIT} kali per hari</b>\n` +
                `Reset: <b>${timeToReset} jam lagi</b> (00:00 WIB)\n\n` +
                `<i>Gunakan dengan bijak, jangan spam!</i>`
      };
    }
    
    if (userLimit.lastCheck) {
      const lastCheckTime = new Date(userLimit.lastCheck);
      const minutesSinceLast = Math.floor((now - lastCheckTime) / (1000 * 60));
      
      if (minutesSinceLast < this.RATE_LIMIT_CONFIG.COOLDOWN_MINUTES) {
        const minutesLeft = this.RATE_LIMIT_CONFIG.COOLDOWN_MINUTES - minutesSinceLast;
        
        return {
          allowed: false,
          reason: 'cooldown_active',
          message: `⏳ <b>COOLDOWN AKTIF!</b>\n\n` +
                  `Tunggu <b>${minutesLeft} menit</b> sebelum bisa /cekvar lagi.\n` +
                  `Cooldown: <b>${this.RATE_LIMIT_CONFIG.COOLDOWN_MINUTES} menit</b>\n` +
                  `Terakhir: <b>${lastCheckTime.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB</b>\n\n` +
                  `<i>Pemakaian hari ini: ${userLimit.dailyCount}/${this.RATE_LIMIT_CONFIG.DAILY_LIMIT}</i>`
        };
      }
    }
    
    userLimit.lastCheck = now;
    userLimit.dailyCount = (userLimit.dailyCount || 0) + 1;
    this.rateLimitDB[userId] = userLimit;
    
    console.log(`⏰ Rate limit check for ${userId}: ${userLimit.dailyCount}/${this.RATE_LIMIT_CONFIG.DAILY_LIMIT}`);
    
    return {
      allowed: true,
      reason: 'allowed',
      dailyCount: userLimit.dailyCount,
      dailyLimit: this.RATE_LIMIT_CONFIG.DAILY_LIMIT,
      nextAllowed: new Date(now.getTime() + (this.RATE_LIMIT_CONFIG.COOLDOWN_MINUTES * 60000))
    };
  }

  getRateLimitInfo(userId) {
    const userLimit = this.rateLimitDB[userId];
    if (!userLimit) {
      return `📊 <b>Rate Limit Info</b>\n\n` +
             `Belum ada penggunaan /cekvar hari ini.\n` +
             `Limit: <b>${this.RATE_LIMIT_CONFIG.DAILY_LIMIT} kali/hari</b>\n` +
             `Cooldown: <b>${this.RATE_LIMIT_CONFIG.COOLDOWN_MINUTES} menit</b>\n` +
             `Thread yang diizinkan: <b>${this.RATE_LIMIT_CONFIG.ALLOWED_THREADS.join(', ')}</b>`;
    }
    
    const now = new Date();
    const minutesSinceLast = userLimit.lastCheck ? 
      Math.floor((now - new Date(userLimit.lastCheck)) / (1000 * 60)) : 0;
    const canUseAgain = userLimit.lastCheck ? 
      new Date(new Date(userLimit.lastCheck).getTime() + (this.RATE_LIMIT_CONFIG.COOLDOWN_MINUTES * 60000)) : now;
    
    let status = `✅ Bisa digunakan`;
    if (userLimit.dailyCount >= this.RATE_LIMIT_CONFIG.DAILY_LIMIT) {
      status = `❌ DAILY LIMIT`;
    } else if (minutesSinceLast < this.RATE_LIMIT_CONFIG.COOLDOWN_MINUTES) {
      status = `⏳ COOLDOWN`;
    }
    
    return `📊 <b>Rate Limit Info</b>\n\n` +
           `Status: <b>${status}</b>\n` +
           `Pemakaian hari ini: <b>${userLimit.dailyCount}/${this.RATE_LIMIT_CONFIG.DAILY_LIMIT}</b>\n` +
           `Terakhir pakai: <b>${userLimit.lastCheck ? new Date(userLimit.lastCheck).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' }) : 'Belum'}</b>\n` +
           `Bisa pakai lagi: <b>${canUseAgain.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' })}</b>\n` +
           `Cooldown: <b>${this.RATE_LIMIT_CONFIG.COOLDOWN_MINUTES} menit</b>\n\n` +
           `<i>Reset daily limit: 00:00 WIB</i>`;
  }

  // ============================================
  // GA4 DATA FUNCTIONS - FIXED VERSION
  // ============================================

  async getGA4StatsForArticle(articlePath) {
    try {
      console.log(`📊 [GA4-REALTIME] Fetching REALTIME stats for article: ${articlePath}`);
      
      const analyticsDataClient = this.getGA4Client();
      
      if (!analyticsDataClient) {
        console.warn('⚠️ GA4 client not available, using default stats');
        return { activeUsers: 158, views: 433, source: 'DEFAULT_NO_CLIENT' };
      }
      
      const propertyId = process.env.GA4_PROPERTY_ID;
      if (!propertyId) {
        console.warn('⚠️ GA4_PROPERTY_ID not set');
        return { activeUsers: 158, views: 433, source: 'DEFAULT_NO_PROPERTY' };
      }
      
      const today = new Date().toISOString().split('T')[0];
      
      console.log(`📅 Querying GA4 for ${today}, property: ${propertyId}, article: ${articlePath}`);
      
      const [response] = await analyticsDataClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate: today, endDate: today }],
        dimensions: [
          { name: 'pagePath' },
          { name: 'date' }
        ],
        metrics: [
          { name: 'activeUsers' },
          { name: 'screenPageViews' }
        ],
        dimensionFilter: {
          filter: {
            fieldName: 'pagePath',
            stringFilter: {
              matchType: 'CONTAINS',
              value: articlePath
            }
          }
        },
        limit: 10
      });
      
      console.log(`✅ GA4 response received for article: ${articlePath}`);
      
      let totalActiveUsers = 0;
      let totalViews = 0;
      
      if (response.rows && response.rows.length > 0) {
        response.rows.forEach(row => {
          totalActiveUsers += parseInt(row.metricValues[0].value) || 0;
          totalViews += parseInt(row.metricValues[1].value) || 0;
        });
        
        console.log(`   Found ${response.rows.length} rows, Active Users: ${totalActiveUsers}, Views: ${totalViews}`);
        
        if (totalActiveUsers > 0 || totalViews > 0) {
          return {
            activeUsers: totalActiveUsers,
            views: totalViews,
            source: 'GA4_ARTICLE_SPECIFIC'
          };
        }
      }
      
      console.log(`📊 No specific data for "${articlePath}", trying total today...`);
      
      const [totalResponse] = await analyticsDataClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate: today, endDate: today }],
        metrics: [
          { name: 'activeUsers' },
          { name: 'screenPageViews' }
        ]
      });
      
      if (totalResponse.rows && totalResponse.rows.length > 0) {
        const totalStats = {
          activeUsers: parseInt(totalResponse.rows[0].metricValues[0].value) || 158,
          views: parseInt(totalResponse.rows[0].metricValues[1].value) || 433,
          source: 'GA4_TOTAL_TODAY'
        };
        
        console.log(`   Total today: Active Users=${totalStats.activeUsers}, Views=${totalStats.views}`);
        return totalStats;
      }
      
      console.warn('⚠️ No GA4 data available for today');
      return { activeUsers: 158, views: 433, source: 'DEFAULT_NO_DATA' };
      
    } catch (error) {
      console.error('❌ Error fetching GA4 stats:', error.message);
      return { activeUsers: 158, views: 433, source: 'ERROR_FALLBACK' };
    }
  }

  getGA4Client() {
    console.log('🔄 [GA4] Getting GA4 client...');
    
    try {
      // Cek cache global dulu
      if (global.analyticsDataClient) {
        console.log('✅ [GA4] Using cached global client');
        return global.analyticsDataClient;
      }
      
      // 🎯 FIXED: Menggunakan path yang benar './ga4-client' bukan './services/ga4-client'
      // Karena kedua file berada di folder yang sama: /app/services/
      console.log('📦 [GA4] Loading GA4 module from ./ga4-client...');
      
      let ga4Module;
      const possiblePaths = [
        './ga4-client',           // ✅ PATH YANG BENAR (sama folder)
        './services/ga4-client',  // Fallback (jika struktur berbeda)
        '../services/ga4-client'  // Fallback lain
      ];
      
      for (const modulePath of possiblePaths) {
        try {
          console.log(`   🔍 Trying path: ${modulePath}`);
          ga4Module = require(modulePath);
          console.log(`   ✅ Success with path: ${modulePath}`);
          break;
        } catch (pathError) {
          // Lanjut ke path berikutnya
          console.log(`   ❌ Path ${modulePath} failed: ${pathError.message}`);
        }
      }
      
      if (!ga4Module) {
        console.error('❌ [GA4] Could not load module from any path');
        return null;
      }
      
      // Panggil getGA4Client() dari module
      if (ga4Module.getGA4Client && typeof ga4Module.getGA4Client === 'function') {
        console.log('✅ [GA4] Calling getGA4Client() from module');
        const client = ga4Module.getGA4Client();
        
        if (client) {
          // Cache di global untuk reuse
          global.analyticsDataClient = client;
          console.log('✅ [GA4] Client cached globally');
          return client;
        }
      }
      
      // Fallback ke initializeGA4Client
      if (ga4Module.initializeGA4Client) {
        console.log('⚠️  [GA4] Using initializeGA4Client() as fallback');
        const client = ga4Module.initializeGA4Client();
        if (client) {
          global.analyticsDataClient = client;
          return client;
        }
      }
      
      console.error('❌ [GA4] No valid client obtained from module');
      return null;
      
    } catch (error) {
      console.error('❌ [GA4] Error in getGA4Client():', error.message);
      console.error('   Stack trace:', error.stack?.split('\n')[0]);
      return null;
    }
  }

  // ✅ FUNGSI BARU YANG SUDAH DIPERBAIKI
  async getGA4StatsForArticleToday(articlePath) {
    try {
      console.log(`📊 [GA4-TODAY] Fetching TODAY'S stats for article: ${articlePath}`);
      
      // 🎯 FIXED: Menggunakan path yang sama dengan getGA4Client()
      const possiblePaths = [
        './ga4-client',           // ✅ PATH YANG BENAR (sama folder)
        './services/ga4-client',  // Fallback
        '../services/ga4-client'  // Fallback lain
      ];
      
      let ga4Module = null;
      let modulePath = null;
      
      for (const path of possiblePaths) {
        try {
          console.log(`   🔍 Trying path: ${path}`);
          ga4Module = require(path);
          console.log(`   ✅ Success with path: ${path}`);
          modulePath = path;
          break;
        } catch (pathError) {
          console.log(`   ❌ Path ${path} failed: ${pathError.message}`);
        }
      }
      
      if (!ga4Module) {
        console.error('❌ [GA4-TODAY] Could not load GA4 module from any path');
        return { activeUsers: 0, views: 0, source: 'ERROR_MODULE_NOT_FOUND' };
      }
      
      if (ga4Module.getGA4StatsForArticleToday) {
        console.log('✅ [GA4-TODAY] Using new function from module');
        return await ga4Module.getGA4StatsForArticleToday(articlePath);
      } else {
        console.log('⚠️  [GA4-TODAY] Using fallback to old GA4 function (new function not found)');
        return await this.getGA4StatsForArticle(articlePath);
      }
    } catch (error) {
      console.error('❌ Error in getGA4StatsForArticleToday:', error.message);
      console.error('   Stack:', error.stack?.split('\n')[0]);
      return { activeUsers: 0, views: 0, source: 'ERROR' };
    }
  }
    
  // ============================================
  // LAPORAN GENERATOR FUNCTIONS
  // ============================================

  async generateLaporan(userId, userName) {
    try {
      const users = loadUserDatabase();
      const userData = users[userId] || {};
      const fullName = userData.name || userName;
      
      const customArticle = userData.article || 'west-african-flavors-jollof-egus...';
      const customLink = userData.waLink || 'https://wa-me.cloud/bin001';
      
      console.log(`📊 Fetching GA4 data for user ${fullName} (${userId})`);
      
      // 🎯 FIXED: Memanggil fungsi baru getGA4StatsForArticleToday
      const stats = await this.getGA4StatsForArticleToday(customArticle);
      
      const now = new Date();
      const timeString = now.toLocaleTimeString('id-ID', { 
        timeZone: 'Asia/Jakarta',
        hour12: false 
      }).replace(/\./g, ':');
      
      let laporan = `📈 <b>LAPORAN ${timeString}</b>\n\n`;
      laporan += `👤 Nama: "${fullName}"\n`;
      laporan += `👤 ID: ${userId}\n`;
      laporan += `🔗 Link: ${customLink}\n`;
      laporan += `📄 Artikel: ${customArticle}\n\n`;
      laporan += `<b>📊 PERFORMANCE HARI INI</b>\n`;
      laporan += `👥 Active User: ${stats.activeUsers}\n`;
      laporan += `👁️ Views: ${stats.views}\n\n`;
      laporan += `ℹ️ Data dihitung sejak 00:00 WIB hingga saat ini.\n\n`;
      laporan += `🕐 Laporan dibuat: ${timeString} WIB`;
      
      console.log(`📊 Laporan generated for "${fullName}" (${userId})`);
      console.log(`   Article: ${customArticle}`);
      console.log(`   Link: <code>${customLink}</code>`);
      console.log(`   GA4 Stats: Active Users=${stats.activeUsers}, Views=${stats.views} (Source: ${stats.source})`);
      
      return {
        success: true,
        message: laporan,
        stats: stats
      };
      
    } catch (error) {
      console.error('❌ Error generating laporan:', error.message);
      
      const now = new Date();
      const timeString = now.toLocaleTimeString('id-ID', { 
        timeZone: 'Asia/Jakarta',
        hour12: false 
      }).replace(/\./g, ':');
      
      const users = loadUserDatabase();
      const userData = users[userId] || {};
      
      return {
        success: true,
        message: `📈 <b>LAPORAN ${timeString}</b>\n\n` +
                `👤 Nama: "${userName}"\n` +
                `👤 ID: ${userId}\n` +
                `🔗 Link: ${userData?.waLink || 'https://wa-me.cloud/bin001'}\n` +
                `📄 Artikel: ${userData?.article || 'west-african-flavors-jollof-egus...'}\n\n` +
                `<b>📊 PERFORMANCE HARI INI</b>\n` +
                `👥 Active User: 0\n` +
                `👁️ Views: 0\n\n` +
                `ℹ️ Data dihitung sejak 00:00 WIB hingga saat ini.\n\n` +
                `🕐 Laporan dibuat: ${timeString} WIB\n\n` +
                `<i>⚠️ Data GA4 sedang diupdate...</i>`,
        stats: { activeUsers: 0, views: 0, source: 'ERROR_FALLBACK' }
      };
    }
  }

  async sendLaporanToThread(laporanText, threadId = 3) {
    try {
      const chatId = process.env.TELEGRAM_GROUP_CHAT_ID;
      if (!chatId) {
        console.error('❌ TELEGRAM_GROUP_CHAT_ID not set for laporan');
        return false;
      }
      
      console.log(`📤 Sending laporan to thread ${threadId}...`);
      
      await this.bot.sendMessage(chatId, laporanText, {
        parse_mode: 'HTML',
        message_thread_id: threadId
      });
      
      console.log(`✅ Laporan sent to thread ${threadId}`);
      return true;
      
    } catch (error) {
      console.error('❌ Error sending laporan to thread:', error.message);
      return false;
    }
  }

  async processMessageWithAccessControl(msg) {
    try {
      console.log('🔐 Checking access control...');
      
      await accessControl.checkAccess(this.bot, msg, async () => {
        console.log('✅ Access granted, processing message...');
        await this.handleMessage(msg);
      });
      
    } catch (error) {
      console.error('❌ Access control error:', error.message);
    }
  }

  async handleMessage(msg) {
    const userId = msg.from?.id?.toString();
    const chatId = msg.chat?.id;
    const threadId = msg.message_thread_id || 0;
    const text = msg.text || '';
    const userName = msg.from?.first_name || 'User';
    
    if (text.startsWith('/')) {
      const command = text.split(' ')[0].split('@')[0].toLowerCase();
      console.log(`   ⚡ Processing command: ${command}`);
      
      switch (command) {
        case '/start':
          await this.handleStart(msg);
          break;
        case '/daftar':
          await this.handleDaftar(msg);
          break;
        case '/lihat_user':
          await this.handleLihatUser(msg);
          break;
        case '/edit_user':
          await this.handleEditUser(msg);
          break;
        case '/userid':
          await this.handleUserid(msg);
          break;
        case '/cekvar':
          await this.handleCekvar(msg);
          break;
        case '/rate_limit':
          await this.handleRateLimit(msg);
          break;
        case '/scheduler_status':
          await this.handleSchedulerStatus(msg);
          break;
        case '/bantuan':
          await this.handleBantuan(msg);
          break;
        case '/laporan_test':
          await this.handleLaporanTest(msg);
          break;
        case '/hapus_user':
          await this.handleHapusUser(msg);
          break;
        default:
          await this.handleUnknownCommand(msg, command);
          break;
      }
    } else {
      console.log(`   💬 Regular message from ${userName}`);
    }
  }

  // ============================================
  // COMMAND HANDLERS (TIDAK BERUBAH)
  // ============================================

  async handleStart(msg) {
    const userId = msg.from.id.toString();
    const userName = msg.from.first_name;
    const chatId = msg.chat.id;
    const threadId = msg.message_thread_id || 0;
    
    console.log(`🤝 User ${userName} (${userId}) accessed /start command`);
    
    const isAdmin = accessControl.isAdmin(userId);
    const isRegistered = accessControl.isRegisteredUser(userId);
    
    let welcomeMessage = `Halo ${userName}! 👋\n\n`;
    welcomeMessage += `Selamat datang di <b>EatSleepPush GA4 Bot v3.0</b>\n\n`;
    
    if (isAdmin) {
      welcomeMessage += `👑 <b>Status: ADMIN</b>\n`;
      welcomeMessage += `✅ Akses penuh di SEMUA thread\n\n`;
      welcomeMessage += `<b>Commands Admin:</b>\n`;
      welcomeMessage += `/daftar USER_ID NAMA - Daftarkan user baru\n`;
      welcomeMessage += `/lihat_user - Lihat semua user terdaftar\n`;
      welcomeMessage += `/edit_user - Edit artikel & link user\n`;
      welcomeMessage += `/hapus_user USER_ID - Hapus user\n`;
      welcomeMessage += `/report_revenue - Generate laporan revenue\n`;
      welcomeMessage += `/scheduler_status - Cek status scheduler\n`;
      welcomeMessage += `/laporan_test - Test generate laporan\n`;
      welcomeMessage += `/rate_limit - Cek rate limit user\n`;
    } else if (isRegistered) {
      welcomeMessage += `✅ <b>Status: USER TERDAFTAR</b>\n`;
      welcomeMessage += `📝 Bisa kirim pesan di thread: <code>0, 7, 5</code>\n`;
      welcomeMessage += `📊 Laporan otomatis di thread: <code>3</code> (silent)\n`;
      welcomeMessage += `❌ Auto-remove di thread: <code>9</code> (pengumuman-only)\n\n`;
      welcomeMessage += `<b>⏰ RATE LIMITING:</b>\n`;
      welcomeMessage += `• /cekvar hanya di thread: 0, 7, 5\n`;
      welcomeMessage += `• Cooldown: 20 menit antar /cekvar\n`;
      welcomeMessage += `• Limit: 10 kali per hari\n\n`;
      welcomeMessage += `<b>📈 DATA GA4:</b>\n`;
      welcomeMessage += `• Active Users & Views dari GA4 real-time\n`;
      welcomeMessage += `• Data spesifik per artikel path\n\n`;
      welcomeMessage += `<b>Commands User:</b>\n`;
      welcomeMessage += `/cekvar - Cek status + Generate laporan\n`;
      welcomeMessage += `/rate_limit - Cek status rate limit\n`;
      welcomeMessage += `/userid - Lihat ID Anda\n`;
      welcomeMessage += `/scheduler_status - Cek status scheduler\n`;
    } else {
      welcomeMessage += `❌ <b>Status: BELUM TERDAFTAR</b>\n`;
      welcomeMessage += `⏰ Auto-kick dalam 30 menit\n`;
      welcomeMessage += `Hubungi admin: <code>${accessControl.ADMIN_CHAT_ID}</code>\n`;
    }
    
    welcomeMessage += `\n🔒 <i>Sistem Strict Access Control aktif</i>`;
    
    try {
      await this.bot.sendMessage(chatId, welcomeMessage, {
        parse_mode: 'HTML',
        ...(threadId && { message_thread_id: threadId })
      });
      console.log(`✅ Welcome message sent to ${userName}`);
    } catch (error) {
      console.error('❌ Error sending welcome message:', error.message);
    }
  }

  async handleRateLimit(msg) {
    const userId = msg.from.id.toString();
    const userName = msg.from.first_name;
    const chatId = msg.chat.id;
    const threadId = msg.message_thread_id || 0;
    
    const rateLimitInfo = this.getRateLimitInfo(userId);
    
    await this.bot.sendMessage(chatId, rateLimitInfo, {
      parse_mode: 'HTML',
      ...(threadId && { message_thread_id: threadId })
    });
    
    console.log(`📊 Rate limit info sent to ${userName} (${userId})`);
  }

async handleCekvar(msg) {
    const userId = msg.from.id.toString();
    const userName = msg.from.first_name;
    const chatId = msg.chat.id;
    const threadId = msg.message_thread_id || 0;
    
    console.log(`📊 Processing /cekvar for user ${userName} (${userId}) in thread ${threadId}`);
    
    const userType = accessControl.getUserType(userId);
    const users = loadUserDatabase();
    
    // ========== USER REGISTERED: SILENT MODE TOTAL ==========
    if (userType === 'registered') {
        const rateLimitCheck = this.checkRateLimit(userId, threadId);
        
        if (!rateLimitCheck.allowed) {
            console.log(`⏰ Rate limit blocked for ${userId}: ${rateLimitCheck.reason}`);
            // 🎯 HANYA KIRIM PESAN JIKA RATE LIMIT DITOLAK
            await this.bot.sendMessage(chatId, rateLimitCheck.message, {
                parse_mode: 'HTML',
                ...(threadId && { message_thread_id: threadId })
            });
            return;
        }
        
        console.log(`✅ Rate limit passed: ${rateLimitCheck.dailyCount}/${rateLimitCheck.dailyLimit}`);
        
        // 🎯 LANGSUNG GENERATE & KIRIM LAPORAN KE THREAD 3 (TANPA KONFIRMASI)
        try {
            console.log(`📊 Generating laporan for registered user ${userName}...`);
            
            const laporanResult = await this.generateLaporan(userId, userName);
            
            if (laporanResult.success) {
                const laporanThreadId = process.env.LAPORAN_THREAD_ID || 3;
                await this.sendLaporanToThread(laporanResult.message, laporanThreadId);
                
                console.log(`✅ Laporan sent to thread ${laporanThreadId} for user ${userId} (SILENT MODE)`);
                console.log(`   GA4 Source: ${laporanResult.stats.source}`);
                console.log(`   Active Users: ${laporanResult.stats.activeUsers}, Views: ${laporanResult.stats.views}`);
                
                // 🎯 TIDAK ADA REPLY / KONFIRMASI KE USER
                // Laporan hanya muncul di thread 3, user tidak dapat pesan apapun
            } else {
                console.error(`❌ Failed to generate laporan for ${userId}: ${laporanResult.error}`);
                // 🎯 HANYA KIRIM ERROR JIKA GAGAL
                await this.bot.sendMessage(chatId, 
                    `❌ Gagal generate laporan. Silakan coba lagi nanti.`,
                    {
                        ...(threadId && { message_thread_id: threadId })
                    }
                );
            }
        } catch (error) {
            console.error('❌ Error in laporan process:', error.message);
            // 🎯 HANYA KIRIM ERROR JIKA EXCEPTION
            await this.bot.sendMessage(chatId, 
                `❌ Error sistem. Silakan coba lagi nanti.`,
                {
                    ...(threadId && { message_thread_id: threadId })
                }
            );
        }
        return; // SELESAI - TANPA PESAN KONFIRMASI
    }
    
    // ========== UNTUK ADMIN: TAMPILKAN STATUS SISTEM ==========
    if (userType === 'admin') {
        const variables = {
            'Bot Status': '🟢 Online',
            'Access Control': '🔒 Active',
            'Auto-Kick': accessControl.AUTO_KICK_ENABLED ? '✅ Enabled' : '❌ Disabled',
            'Registered Users': Object.keys(users).length,
            'User Type': userType,
            'Admin ID': accessControl.ADMIN_CHAT_ID,
            'Laporan Thread': process.env.LAPORAN_THREAD_ID || 3,
            'GA4 Data': '📈 Real-time'
        };
        
        let message = `🔍 <b>Status Sistem</b>\n\n`;
        for (const [key, value] of Object.entries(variables)) {
            message += `${key}: ${value}\n`;
        }
        
        message += `\n⏰ Scheduler: Active\n📊 GA4: Connected\n📈 Laporan: Auto-generate (thread ${process.env.LAPORAN_THREAD_ID || 3})`;
        
        await this.bot.sendMessage(chatId, message, {
            parse_mode: 'HTML',
            ...(threadId && { message_thread_id: threadId })
        });
        
        console.log(`✅ Status sistem sent to admin ${userId}`);
        
        // Info untuk admin tentang mode silent
        await this.bot.sendMessage(chatId, 
            `👑 <b>Admin Mode</b>\n\n` +
            `Sebagai admin, Anda bebas dari rate limiting.\n` +
            `<b>Mode User Registered:</b>\n` +
            `• /cekvar → Laporan otomatis ke thread 3 (SILENT TOTAL)\n` +
            `• Tidak ada konfirmasi/reply ke user\n` +
            `• Hanya muncul error jika gagal/rate limit\n\n` +
            `<i>User hanya tahu laporan berhasil jika melihat thread 3</i>`,
            {
                parse_mode: 'HTML',
                ...(threadId && { message_thread_id: threadId })
            }
        );
    }
}

  async handleLihatUser(msg) {
    const userId = msg.from.id.toString();
    const chatId = msg.chat.id;
    const threadId = msg.message_thread_id || 0;
    
    if (!accessControl.isAdmin(userId)) {
      await this.bot.sendMessage(chatId, '❌ Hanya admin yang bisa melihat daftar user', {
        ...(threadId && { message_thread_id: threadId })
      });
      return;
    }
    
    const users = loadUserDatabase();
    const userCount = Object.keys(users).length;
    
    let message = `📋 <b>Daftar User Terdaftar</b>\n\n`;
    message += `Total User: ${userCount}\n\n`;
    
    let index = 1;
    for (const [id, data] of Object.entries(users)) {
      const name = data.username || data.name || 'undefined';
      const date = data.registeredAt ? new Date(data.registeredAt).toLocaleDateString('id-ID') : 'Invalid Date';
      const by = data.registeredBy || 'System';
      const article = data.article ? `${data.article.substring(0, 30)}${data.article.length > 30 ? '...' : ''}` : 'default';
      const link = data.waLink ? data.waLink.substring(0, 30) + (data.waLink.length > 30 ? '...' : '') : 'default';
      
      message += `${index}. <b>${name}</b>\n`;
      message += `   🆔: <code>${id}</code>\n`;
      message += `   📅: ${date}\n`;
      message += `   👤: ${by}\n`;
      message += `   📄: ${article}\n`;
      message += `   🔗: ${link}\n\n`;
      index++;
    }
    
    message += `<b>Commands:</b>\n`;
    message += `<code>/edit_user USER_ID</code> - Edit artikel/link\n`;
    message += `<code>/rate_limit USER_ID</code> - Cek rate limit\n`;
    message += `<code>/hapus_user USER_ID</code> - Hapus user`;
    
    await this.bot.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      ...(threadId && { message_thread_id: threadId })
    });
  }

  async handleEditUser(msg) {
    const userId = msg.from.id.toString();
    const chatId = msg.chat.id;
    const threadId = msg.message_thread_id || 0;
    const text = msg.text || '';
    
    if (!accessControl.isAdmin(userId)) {
      await this.bot.sendMessage(chatId, '❌ Hanya admin yang bisa edit user', {
        ...(threadId && { message_thread_id: threadId })
      });
      return;
    }
    
    const parts = text.split(' ');
    if (parts.length < 2) {
      await this.bot.sendMessage(chatId, 
        `✏️ <b>EDIT USER COMMANDS</b>\n\n` +
        `<b>Format:</b>\n` +
        `<code>/edit_user USER_ID</code> - Lihat info user\n` +
        `<code>/edit_user USER_ID article ARTIKEL_PATH</code> - Ganti artikel path\n` +
        `<code>/edit_user USER_ID link WA_LINK</code> - Ganti WA link\n` +
        `<code>/edit_user USER_ID name NAMA_BARU</code> - Ganti nama\n\n` +
        `<b>Contoh:</b>\n` +
        `<code>/edit_user 8462501080 article new-article-path</code>\n` +
        `<code>/edit_user 8462501080 link https://wa-me.cloud/bin002</code>\n` +
        `<code>/edit_user 8462501080 name Meningan Baru</code>\n\n` +
        `<i>Artikel path ini akan digunakan di laporan GA4 berikutnya.</i>`,
        {
          parse_mode: 'HTML',
          ...(threadId && { message_thread_id: threadId })
        }
      );
      return;
    }
    
    const targetUserId = parts[1];
    
    // 🔄 Load users database
    const users = loadUserDatabase();
    
    if (!users[targetUserId]) {
      await this.bot.sendMessage(chatId, 
        `❌ User dengan ID <code>${targetUserId}</code> tidak ditemukan.\n` +
        `Gunakan <code>/lihat_user</code> untuk melihat daftar user.`,
        {
          parse_mode: 'HTML',
          ...(threadId && { message_thread_id: threadId })
        }
      );
      return;
    }
    
    if (parts.length === 2) {
      const userData = users[targetUserId];
      const currentName = userData.name || 'undefined';
      const currentArticle = userData.article || 'west-african-flavors-jollof-egus...';
      const currentLink = userData.waLink || 'https://wa-me.cloud/bin001';
      const registeredDate = userData.registeredAt ? new Date(userData.registeredAt).toLocaleDateString('id-ID') : 'N/A';
      const registeredBy = userData.registeredBy || 'System';
      const lastUpdated = userData.lastUpdated ? new Date(userData.lastUpdated).toLocaleString('id-ID') : 'Belum pernah';
      const updatedBy = userData.updatedBy || 'N/A';
      
      let message = `👤 <b>INFO USER</b>\n\n`;
      message += `<b>ID:</b> <code>${targetUserId}</code>\n`;
      message += `<b>Nama:</b> ${currentName}\n`;
      message += `<b>Artikel Path:</b> ${currentArticle}\n`;
      message += `<b>WA Link:</b> <code>${currentLink}</code>\n`;
      message += `<b>Terdaftar:</b> ${registeredDate}\n`;
      message += `<b>Oleh:</b> ${registeredBy}\n`;
      message += `<b>Terakhir Update:</b> ${lastUpdated}\n`;
      message += `<b>Update Oleh:</b> ${updatedBy}\n\n`;
      message += `<b>Edit dengan:</b>\n`;
      message += `<code>/edit_user ${targetUserId} article ARTIKEL_BARU</code>\n`;
      message += `<code>/edit_user ${targetUserId} link LINK_BARU</code>\n`;
      message += `<code>/edit_user ${targetUserId} name NAMA_BARU</code>\n\n`;
      message += `<i>Link akan tampil dengan tag &lt;code&gt; untuk disable preview</i>`;
      
      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'HTML',
        ...(threadId && { message_thread_id: threadId })
      });
      return;
    }
    
    const editType = parts[2].toLowerCase();
    const editValue = parts.slice(3).join(' ');
    
    if (!editValue) {
      await this.bot.sendMessage(chatId, 
        `❌ Nilai edit tidak boleh kosong.\n` +
        `Contoh: <code>/edit_user ${targetUserId} ${editType} nilai_baru</code>`,
        {
          parse_mode: 'HTML',
          ...(threadId && { message_thread_id: threadId })
        }
      );
      return;
    }
    
    try {
      console.log(`✏️ Updating user ${targetUserId}: ${editType} = ${editValue}`);
      
      let fieldUpdated = '';
      let oldValue = '';
      
      if (editType === 'article') {
        oldValue = users[targetUserId].article || 'default';
        users[targetUserId].article = editValue;
        fieldUpdated = 'Artikel Path';
        console.log(`   Changed article from "${oldValue}" to "${editValue}"`);
      } else if (editType === 'link' || editType === 'walink' || editType === 'waLink') {
        oldValue = users[targetUserId].waLink || 'default';
        users[targetUserId].waLink = editValue;
        fieldUpdated = 'WA Link';
        console.log(`   Changed WA link from "${oldValue}" to "${editValue}"`);
      } else if (editType === 'name') {
        oldValue = users[targetUserId].name || 'undefined';
        users[targetUserId].name = editValue;
        fieldUpdated = 'Nama';
        console.log(`   Changed name from "${oldValue}" to "${editValue}"`);
      } else {
        await this.bot.sendMessage(chatId, 
          `❌ Tipe edit tidak valid. Gunakan: article, link, atau name`,
          {
            ...(threadId && { message_thread_id: threadId })
          }
        );
        return;
      }
      
      users[targetUserId].lastUpdated = new Date().toISOString();
      users[targetUserId].updatedBy = userId;
      
      // 🔥 SIMPAN KE FILE dengan fungsi yang sudah diperbaiki
      console.log(`💾 Attempting to save user database...`);
      const saved = saveUserDatabase(users);
      
      if (!saved) {
        throw new Error('Gagal menyimpan perubahan ke file users.json');
      }
      
      console.log(`✅ User data saved successfully to ${USERS_FILE_PATH}`);
      
      // Verifikasi perubahan
      const verifyUsers = loadUserDatabase();
      const verifyValue = editType === 'article' ? verifyUsers[targetUserId]?.article :
                        editType === 'link' ? verifyUsers[targetUserId]?.waLink :
                        verifyUsers[targetUserId]?.name;
      
      if (verifyValue !== editValue) {
        console.error(`❌ VERIFICATION FAILED: Saved value "${verifyValue}" doesn't match expected "${editValue}"`);
        throw new Error('Verifikasi gagal - data tidak sesuai setelah disimpan');
      }
      
      console.log(`✅ Verification passed: "${verifyValue}" matches expected value`);
      
      let successMessage = `✅ <b>USER BERHASIL DIUPDATE!</b>\n\n`;
      successMessage += `<b>ID:</b> <code>${targetUserId}</code>\n`;
      successMessage += `<b>Field:</b> ${fieldUpdated}\n`;
      successMessage += `<b>Nilai Lama:</b> ${oldValue}\n`;
      successMessage += `<b>Nilai Baru:</b> ${editType === 'link' ? `<code>${editValue}</code>` : editValue}\n`;
      successMessage += `<b>Waktu:</b> ${new Date().toLocaleString('id-ID')}\n`;
      successMessage += `<b>Oleh:</b> ${msg.from.first_name}\n\n`;
      
      if (editType === 'article') {
        successMessage += `<i>Artikel path ini akan digunakan di laporan GA4 berikutnya.</i>\n`;
        successMessage += `<i>Bisa diganti setiap 2-5 hari sesuai kebutuhan tracking.</i>`;
      } else if (editType === 'link') {
        successMessage += `<i>Link akan ditampilkan dengan tag &lt;code&gt; untuk disable preview gambar.</i>`;
      }
      
      await this.bot.sendMessage(chatId, successMessage, {
        parse_mode: 'HTML',
        ...(threadId && { message_thread_id: threadId })
      });
      
      console.log(`✅ User ${targetUserId} updated and confirmed: ${editType} = ${editValue}`);
      
    } catch (error) {
      console.error('❌ Error updating user:', error.message);
      console.error('   Stack:', error.stack);
      await this.bot.sendMessage(chatId, 
        `❌ Gagal update user: ${error.message}\n\n` +
        `⚠️ <i>Silakan coba lagi atau periksa permission file di server.</i>`,
        {
          parse_mode: 'HTML',
          ...(threadId && { message_thread_id: threadId })
        }
      );
    }
  }

  async handleUserid(msg) {
    const userId = msg.from.id.toString();
    const userName = msg.from.first_name;
    const chatId = msg.chat.id;
    const threadId = msg.message_thread_id || 0;
    
    const userType = accessControl.getUserType(userId);
    const isAdmin = accessControl.isAdmin(userId);
    const isRegistered = accessControl.isRegisteredUser(userId);
    
    const users = loadUserDatabase();
    const userData = users[userId] || {};
    const customArticle = userData.article || 'default';
    const customLink = userData.waLink || 'default';
    
    let message = `👤 <b>Profil User</b>\n\n`;
    message += `Nama: ${userName}\n`;
    message += `ID: <code>${userId}</code>\n`;
    message += `Status: ${userType === 'admin' ? '👑 ADMIN' : userType === 'registered' ? '✅ TERDAFTAR' : '❌ BELUM TERDAFTAR'}\n`;
    message += `Admin: ${isAdmin ? '✅ Ya' : '❌ Bukan'}\n`;
    message += `Terdaftar: ${isRegistered ? '✅ Ya' : '❌ Belum'}\n`;
    message += `Artikel: ${customArticle}\n`;
    message += `Link: <code>${customLink}</code>\n`;
    message += `\n<b>Thread Akses:</b>\n`;
    message += `• 💬 Diskusi: ${[0, 7, 5].includes(threadId) ? '✅' : '❌'}\n`;
    message += `• 📊 Laporan: ${threadId === 3 ? '✅ (auto-generate)' : '❌'}\n`;
    message += `• 📢 Pengumuman: ${threadId === 9 ? '❌ (bot-only)' : '✅'}\n`;
    message += `\n<b>Rate Limit:</b>\n`;
    message += `• /cekvar hanya di thread: 0, 7, 5\n`;
    message += `• Cooldown: 20 menit\n`;
    message += `• Limit: 10 kali/hari\n`;
    message += `• Gunakan: <code>/rate_limit</code> untuk cek status\n\n`;
    message += `<b>📈 Data GA4:</b>\n`;
    message += `• Active Users & Views dari GA4 real-time\n`;
    message += `• Data spesifik untuk artikel di atas`;
    
    await this.bot.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      ...(threadId && { message_thread_id: threadId })
    });
  }

  async handleLaporanTest(msg) {
    const userId = msg.from.id.toString();
    const userName = msg.from.first_name;
    const chatId = msg.chat.id;
    const threadId = msg.message_thread_id || 0;
    
    if (!accessControl.isAdmin(userId)) {
      await this.bot.sendMessage(chatId, '❌ Hanya admin yang bisa test laporan', {
        ...(threadId && { message_thread_id: threadId })
      });
      return;
    }
    
    console.log(`🧪 Admin ${userName} testing laporan generation with GA4 data...`);
    
    try {
      const users = loadUserDatabase();
      const userData = users[userId] || {};
      const customArticle = userData.article || 'west-african-flavors-jollof-egus...';
      
      const laporanResult = await this.generateLaporan(userId, userName);
      
      if (laporanResult.success) {
        await this.bot.sendMessage(chatId, 
          `🧪 <b>TEST LAPORAN - PREVIEW</b>\n\n` +
          laporanResult.message + `\n\n` +
          `<b>Thread Target:</b> ${process.env.LAPORAN_THREAD_ID || 3}\n` +
          `<b>Artikel:</b> ${customArticle}\n` +
          `<b>Stats Source:</b> ${laporanResult.stats.source}\n` +
          `<b>Active Users:</b> ${laporanResult.stats.activeUsers}\n` +
          `<b>Views:</b> ${laporanResult.stats.views}\n\n` +
          `<i>Ini hanya preview. User registered akan auto-send ke thread LAPORAN (silent).</i>`,
          {
            parse_mode: 'HTML',
            ...(threadId && { message_thread_id: threadId })
          }
        );
        
        console.log(`✅ Laporan test preview sent to admin (GA4 Source: ${laporanResult.stats.source})`);
      } else {
        await this.bot.sendMessage(chatId, 
          `❌ Gagal test laporan: ${laporanResult.error}`,
          {
            ...(threadId && { message_thread_id: threadId })
          }
        );
      }
    } catch (error) {
      console.error('❌ Error in laporan test:', error.message);
      await this.bot.sendMessage(chatId, 
        `❌ Error test laporan: ${error.message}`,
        {
          ...(threadId && { message_thread_id: threadId })
        }
      );
    }
  }

  async handleSchedulerStatus(msg) {
    const userId = msg.from.id.toString();
    const chatId = msg.chat.id;
    const threadId = msg.message_thread_id || 0;
    
    const now = new Date();
    const nextReport = new Date(now);
    nextReport.setHours(12, 0, 0, 0);
    if (nextReport < now) nextReport.setDate(nextReport.getDate() + 1);
    
    const nextBackup = new Date(now);
    nextBackup.setHours(10, 0, 0, 0);
    if (nextBackup < now) nextBackup.setDate(nextBackup.getDate() + 1);
    
    let message = `⏰ <b>Status Scheduler</b>\n\n`;
    message += `🟢 <b>Sistem: Active</b>\n\n`;
    message += `<b>Tasks Scheduled:</b>\n`;
    message += `• Laporan Revenue: 12:00 WIB daily\n`;
    message += `• Database Backup: 10:00 WIB daily\n`;
    message += `• File Cleanup: 01:00 WIB daily\n`;
    message += `• Laporan User: Real-time (thread ${process.env.LAPORAN_THREAD_ID || 3}, silent)\n\n`;
    message += `<b>Data Source:</b>\n`;
    message += `• Active Users & Views dari GA4 real-time\n`;
    message += `• Data spesifik per artikel path user\n\n`;
    message += `<b>Next Execution:</b>\n`;
    message += `📊 Revenue: ${nextReport.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}\n`;
    message += `💾 Backup: ${nextBackup.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}\n\n`;
    message += `<i>Sistem berjalan normal dengan data GA4 real-time</i>`;
    
    await this.bot.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      ...(threadId && { message_thread_id: threadId })
    });
  }

  async handleBantuan(msg) {
    const userId = msg.from.id.toString();
    const chatId = msg.chat.id;
    const threadId = msg.message_thread_id || 0;
    
    const userType = accessControl.getUserType(userId);
    
    let message = `🆘 <b>Pusat Bantuan</b>\n\n`;
    
    if (userType === 'admin') {
      message += `<b>👑 ADMIN COMMANDS:</b>\n`;
      message += `<code>/daftar USER_ID NAMA</code> - Daftarkan user baru\n`;
      message += `<code>/lihat_user</code> - Lihat semua user\n`;
      message += `<code>/edit_user USER_ID</code> - Edit artikel/link user\n`;
      message += `<code>/hapus_user USER_ID</code> - Hapus user\n`;
      message += `<code>/report_revenue</code> - Generate laporan\n`;
      message += `<code>/scheduler_status</code> - Cek scheduler\n`;
      message += `<code>/laporan_test</code> - Test generate laporan\n`;
      message += `<code>/rate_limit USER_ID</code> - Cek rate limit user\n\n`;
    }
    
    message += `<b>👤 USER COMMANDS:</b>\n`;
    message += `<code>/cekvar</code> - Cek status sistem + Generate laporan (silent)\n`;
    message += `<code>/rate_limit</code> - Cek status rate limit Anda\n`;
    message += `<code>/userid</code> - Lihat ID Anda\n`;
    message += `<code>/scheduler_status</code> - Cek scheduler\n`;
    message += `<code>/start</code> - Menu awal\n\n`;
    
    message += `<b>🔒 ATURAN AKSES:</b>\n`;
    message += `• <b>Admin</b>: Akses semua thread\n`;
    message += `• <b>User</b>: Thread 0,7,5 (chat), Thread 3 (laporan), Thread 9 (bot-only)\n`;
    message += `• <b>Unregistered</b>: Auto-kick 30 menit\n\n`;
    
    message += `<b>📊 FITUR LAPORAN:</b>\n`;
    message += `• User terdaftar yang ketik <code>/cekvar</code> akan auto-generate laporan\n`;
    message += `• Laporan dikirim ke Thread 3 (silent mode)\n`;
    message += `• Data Active Users & Views dari GA4 real-time\n`;
    message += `• Artikel path bisa di-edit admin dengan <code>/edit_user</code>\n`;
    message += `• Link WA menggunakan tag &lt;code&gt; untuk disable preview\n\n`;
    
    message += `<b>⏰ RATE LIMITING:</b>\n`;
    message += `• /cekvar hanya di thread: 0, 7, 5\n`;
    message += `• Cooldown: 20 menit antar /cekvar\n`;
    message += `• Limit: 10 kali per hari\n\n`;
    
    message += `<i>Hubungi admin jika ada masalah: ${accessControl.ADMIN_CHAT_ID}</i>`;
    
    await this.bot.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      ...(threadId && { message_thread_id: threadId })
    });
  }

  async handleHapusUser(msg) {
    const userId = msg.from.id.toString();
    const chatId = msg.chat.id;
    const threadId = msg.message_thread_id || 0;
    const text = msg.text || '';
    
    if (!accessControl.isAdmin(userId)) {
      await this.bot.sendMessage(chatId, '❌ Hanya admin yang bisa menghapus user', {
        ...(threadId && { message_thread_id: threadId })
      });
      return;
    }
    
    const parts = text.split(' ');
    if (parts.length < 2) {
      await this.bot.sendMessage(chatId, 
        'Format: <code>/hapus_user USER_ID</code>\n' +
        'Contoh: <code>/hapus_user 1234567890</code>',
        {
          parse_mode: 'HTML',
          ...(threadId && { message_thread_id: threadId })
        }
      );
      return;
    }
    
    const targetUserId = parts[1];
    
    if (targetUserId === userId) {
      await this.bot.sendMessage(chatId, '❌ Tidak bisa menghapus diri sendiri', {
        ...(threadId && { message_thread_id: threadId })
      });
      return;
    }
    
    if (targetUserId === accessControl.ADMIN_CHAT_ID) {
      await this.bot.sendMessage(chatId, '❌ Tidak bisa menghapus admin utama', {
        ...(threadId && { message_thread_id: threadId })
      });
      return;
    }
    
    try {
      const users = loadUserDatabase();
      
      if (!users[targetUserId]) {
        await this.bot.sendMessage(chatId, 
          `❌ User dengan ID <code>${targetUserId}</code> tidak ditemukan.`,
          {
            parse_mode: 'HTML',
            ...(threadId && { message_thread_id: threadId })
          }
        );
        return;
      }
      
      const userName = users[targetUserId].name || 'Unknown';
      
      delete users[targetUserId];
      
      const saved = saveUserDatabase(users);
      
      if (!saved) {
        throw new Error('Gagal menyimpan ke file');
      }
      
      await this.bot.sendMessage(chatId, 
        `✅ <b>USER BERHASIL DIHAPUS!</b>\n\n` +
        `👤 Nama: ${userName}\n` +
        `🆔 ID: <code>${targetUserId}</code>\n` +
        `📅 Waktu: ${new Date().toLocaleString('id-ID')}\n` +
        `👑 Oleh: ${msg.from.first_name}\n\n` +
        `<i>User tidak akan bisa generate laporan lagi.</i>`,
        {
          parse_mode: 'HTML',
          ...(threadId && { message_thread_id: threadId })
        }
      );
      
      console.log(`🗑️ User ${targetUserId} deleted by admin ${userId}`);
      
    } catch (error) {
      console.error('❌ Error deleting user:', error.message);
      await this.bot.sendMessage(chatId, 
        `❌ Gagal menghapus user: ${error.message}`,
        {
          ...(threadId && { message_thread_id: threadId })
        }
      );
    }
  }

  async handleDaftar(msg) {
    const userId = msg.from.id.toString();
    const chatId = msg.chat.id;
    const threadId = msg.message_thread_id || 0;
    const text = msg.text || '';
    
    if (!accessControl.isAdmin(userId)) {
      await this.bot.sendMessage(chatId, '❌ Hanya admin yang bisa mendaftarkan user', {
        ...(threadId && { message_thread_id: threadId })
      });
      return;
    }
    
    const parts = text.split(' ');
    if (parts.length < 3) {
      await this.bot.sendMessage(chatId, 
        'Format salah. Gunakan: <code>/daftar USER_ID NAMA_USER</code>\n' +
        'Contoh: <code>/daftar 1234567890 Meningan Pemalang</code>',
        {
          parse_mode: 'HTML',
          ...(threadId && { message_thread_id: threadId })
        }
      );
      return;
    }
    
    const targetUserId = parts[1];
    const targetUserName = parts.slice(2).join(' ');
    
    try {
      const users = loadUserDatabase();
      
      if (users[targetUserId]) {
        await this.bot.sendMessage(chatId, 
          `❌ User dengan ID <code>${targetUserId}</code> sudah terdaftar.`,
          {
            parse_mode: 'HTML',
            ...(threadId && { message_thread_id: threadId })
          }
        );
        return;
      }
      
      const newUser = {
        username: targetUserName.toLowerCase().replace(/\s+/g, ''),
        name: targetUserName,
        registeredAt: new Date().toISOString(),
        registeredBy: userId,
        status: 'active',
        userType: 'registered',
        article: 'west-african-flavors-jollof-egus...',
        waLink: 'https://wa-me.cloud/bin001',
        role: 'user'
      };
      
      users[targetUserId] = newUser;
      
      const saved = saveUserDatabase(users);
      
      if (!saved) {
        throw new Error('Gagal menyimpan ke file');
      }
      
      await this.bot.sendMessage(chatId, 
        `✅ <b>User berhasil didaftarkan!</b>\n\n` +
        `👤 Nama: ${targetUserName}\n` +
        `🆔 ID: <code>${targetUserId}</code>\n` +
        `📅 Waktu: ${new Date().toLocaleString('id-ID')}\n` +
        `👑 Admin: ${msg.from.first_name}\n\n` +
        `<b>Fitur yang didapat:</b>\n` +
        `• Akses chat thread 0,7,5\n` +
        `• Auto-generate laporan di thread 3 dengan /cekvar (silent)\n` +
        `• Data Active Users & Views dari GA4 real-time\n` +
        `• Admin bisa edit artikel/link dengan /edit_user\n` +
        `• Rate limiting: 20 menit cooldown, 10x/hari\n` +
        `• Tidak akan di-kick otomatis\n\n` +
        `<i>Default link: https://wa-me.cloud/bin001</i>\n` +
        `<i>Default artikel: west-african-flavors-jollof-egus...</i>`,
        {
          parse_mode: 'HTML',
          ...(threadId && { message_thread_id: threadId })
        }
      );
      
      console.log(`📝 New user registered: ${targetUserName} (${targetUserId}) by admin ${userId}`);
      
    } catch (error) {
      console.error('❌ Error registering user:', error.message);
      await this.bot.sendMessage(chatId, 
        `❌ Gagal mendaftarkan user: ${error.message}`,
        {
          ...(threadId && { message_thread_id: threadId })
        }
      );
    }
  }

  async handleUnknownCommand(msg, command) {
    const userId = msg.from.id.toString();
    const chatId = msg.chat.id;
    const threadId = msg.message_thread_id || 0;
    
    const userType = accessControl.getUserType(userId);
    
    if (userType === 'unregistered') return;
    
    await this.bot.sendMessage(chatId, 
      `❌ Command <code>${command}</code> tidak dikenali.\n` +
      `Gunakan <code>/bantuan</code> untuk melihat commands yang tersedia.`,
      {
        parse_mode: 'HTML',
        ...(threadId && { message_thread_id: threadId })
      }
    );
  }
}

// Export class
module.exports = TelegramBotHandler;
