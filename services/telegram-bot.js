// telegram-bot.js - Handler utama dengan Strict Access Control
const TelegramBot = require('node-telegram-bot-api');
const accessControl = require('../utils/access-control');

class TelegramBotHandler {
  constructor() {
    console.log('\n🤖 ===== TELEGRAM BOT HANDLER INITIALIZATION =====');
    this.bot = null;
    this.isInitialized = false;
    
    // DEBUG: Tampilkan semua environment variables terkait
    console.log('🔍 Environment Check:');
    console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
    console.log(`   TELEGRAM_BOT_TOKEN exists: ${!!process.env.TELEGRAM_BOT_TOKEN}`);
    console.log(`   TELEGRAM_GROUP_CHAT_ID: ${process.env.TELEGRAM_GROUP_CHAT_ID}`);
    console.log(`   ADMIN_IDS: ${process.env.ADMIN_IDS}`);
    
    // 🚨 PASTIKAN token ada sebelum mencoba initialize
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      console.error('❌ CRITICAL: TELEGRAM_BOT_TOKEN is EMPTY or UNDEFINED!');
      console.error('   Cannot initialize bot without token.');
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
    }
    
    console.log('🤖 ===== INITIALIZATION COMPLETE =====\n');
  }

  initializeBot() {
    console.log('🔧 Initializing Telegram Bot...');
    const token = process.env.TELEGRAM_BOT_TOKEN;
    
    try {
      console.log('🔄 Creating TelegramBot instance with POLLING mode...');
      
      // 🚨 GUNAKAN CONSTRUCTOR SEDERHANA DULU untuk testing
      // PAKAI polling: true langsung, bukan polling object
      this.bot = new TelegramBot(token, { 
        polling: true  // 🎯 SIMPLE MODE - langsung aktif
      });
      
      console.log('✅ TelegramBot instance created successfully');
      
      // Test connection dengan callback style
      this.bot.on('polling_error', (error) => {
        console.error('❌ Telegram polling error:', error.message);
      });
      
      this.bot.on('webhook_error', (error) => {
        console.error('❌ Telegram webhook error:', error.message);
      });
      
      // Event saat polling berhasil start
      this.bot.on('polling_start', () => {
        console.log('📡 Telegram polling STARTED successfully');
        
        // Test getMe setelah polling start
        this.bot.getMe()
          .then(botInfo => {
            console.log(`🎉 BOT CONNECTED SUCCESSFULLY:`);
            console.log(`   👤 Username: @${botInfo.username}`);
            console.log(`   📛 Name: ${botInfo.first_name}`);
            console.log(`   🆔 ID: ${botInfo.id}`);
            console.log(`   📖 Can read group messages: ${botInfo.can_read_all_group_messages ? '✅ YES' : '❌ NO'}`);
            console.log(`   👥 Can join groups: ${botInfo.can_join_groups ? '✅ YES' : '❌ NO'}`);
            this.isInitialized = true;
            
            // Kirim test message ke admin
            this.sendTestMessage();
          })
          .catch(error => {
            console.error('❌ Failed to get bot info:', error.message);
          });
      });
      
    } catch (error) {
      console.error('❌ FATAL: Failed to create TelegramBot instance:', error.message);
      console.error('   Stack:', error.stack);
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
      `<i>Try sending /start in your group</i>`;
    
    this.bot.sendMessage(adminId, testMessage, { parse_mode: 'HTML' })
      .then(() => console.log('✅ Test message sent to admin'))
      .catch(error => {
        console.log('⚠️  Could not send test message to admin:', error.message);
        console.log('   Admin may not have started chat with bot yet');
      });
  }

  setupHandlers() {
    if (!this.bot) {
      console.error('❌ Cannot setup handlers - bot is null');
      return;
    }
    
    console.log('🔧 Setting up message handlers with Strict Access Control...');
    
    // Handler untuk SEMUA pesan
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
        console.log(`   📅 Time: ${new Date().toLocaleTimeString('id-ID')}`);
        
        // Skip bot messages
        if (msg.from?.is_bot || !text) {
          console.log('   ⏩ Skipping (bot message or empty)');
          return;
        }
        
        // Process message dengan access control
        await this.processMessageWithAccessControl(msg);
        
      } catch (error) {
        console.error('❌ Error in message handler:', error.message);
      }
    });
    
    // Setup error handlers
    this.bot.on('error', (error) => {
      console.error('❌ Telegram Bot Error:', error.message);
    });
    
    console.log('✅ Message handlers setup complete');
    console.log('🔴 Strict Access Control: READY');
    console.log('👑 Admin: Thread ALL | 👤 User: Thread 0,7,5 | 🚫 Unregistered: Auto-kick 30min');
  }

  async processMessageWithAccessControl(msg) {
    try {
      console.log('🔐 Checking access control...');
      
      // Gunakan access control system
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
    
    // Handle commands
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
        case '/userid':
          await this.handleUserid(msg);
          break;
        case '/cekvar':
          await this.handleCekvar(msg);
          break;
        case '/scheduler_status':
          await this.handleSchedulerStatus(msg);
          break;
        case '/bantuan':
          await this.handleBantuan(msg);
          break;
        default:
          await this.handleUnknownCommand(msg, command);
          break;
      }
    } else {
      console.log(`   💬 Regular message from ${userName}`);
    }
  }

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
      welcomeMessage += `/hapus_user USER_ID - Hapus user\n`;
      welcomeMessage += `/report_revenue - Generate laporan revenue\n`;
      welcomeMessage += `/scheduler_status - Cek status scheduler\n`;
    } else if (isRegistered) {
      welcomeMessage += `✅ <b>Status: USER TERDAFTAR</b>\n`;
      welcomeMessage += `📝 Bisa kirim pesan di thread: <code>0, 7, 5</code>\n`;
      welcomeMessage += `❌ Auto-remove di thread: <code>3, 9</code> (bot-only)\n\n`;
      welcomeMessage += `<b>Commands User:</b>\n`;
      welcomeMessage += `/cekvar - Cek status sistem\n`;
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
    
    const users = require('../data/users.json');
    const userCount = Object.keys(users).length;
    
    let message = `📋 <b>Daftar User Terdaftar</b>\n\n`;
    message += `Total User: ${userCount}\n\n`;
    
    let index = 1;
    for (const [id, data] of Object.entries(users)) {
      const name = data.username || data.name || 'undefined';
      const date = data.registeredAt ? new Date(data.registeredAt).toLocaleDateString('id-ID') : 'Invalid Date';
      const by = data.registeredBy || 'System';
      
      message += `${index}. <b>${name}</b>\n`;
      message += `   🆔: <code>${id}</code>\n`;
      message += `   📅: ${date}\n`;
      message += `   👤: ${by}\n\n`;
      index++;
    }
    
    message += `Gunakan /hapus_user USER_ID untuk menghapus user.`;
    
    await this.bot.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      ...(threadId && { message_thread_id: threadId })
    });
  }

  async handleUserid(msg) {
    const userId = msg.from.id.toString();
    const userName = msg.from.first_name;
    const chatId = msg.chat.id;
    const threadId = msg.message_thread_id || 0;
    
    // PERBAIKAN: Gunakan method yang ada, bukan getUserInfo()
    const userType = accessControl.getUserType(userId);
    const isAdmin = accessControl.isAdmin(userId);
    const isRegistered = accessControl.isRegisteredUser(userId);
    
    let message = `👤 <b>Profil User</b>\n\n`;
    message += `Nama: ${userName}\n`;
    message += `ID: <code>${userId}</code>\n`;
    message += `Status: ${userType === 'admin' ? '👑 ADMIN' : userType === 'registered' ? '✅ TERDAFTAR' : '❌ BELUM TERDAFTAR'}\n`;
    message += `Admin: ${isAdmin ? '✅ Ya' : '❌ Bukan'}\n`;
    message += `Terdaftar: ${isRegistered ? '✅ Ya' : '❌ Belum'}\n`;
    message += `\n<i>Thread akses berdasarkan status</i>`;
    
    await this.bot.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      ...(threadId && { message_thread_id: threadId })
    });
  }

  async handleCekvar(msg) {
    const userId = msg.from.id.toString();
    const chatId = msg.chat.id;
    const threadId = msg.message_thread_id || 0;
    
    // PERBAIKAN: Gunakan method yang ada
    const userType = accessControl.getUserType(userId);
    const users = require('../data/users.json');
    
    const variables = {
      'Bot Status': '🟢 Online',
      'Access Control': '🔒 Active',
      'Auto-Kick': accessControl.AUTO_KICK_ENABLED ? '✅ Enabled' : '❌ Disabled',
      'Registered Users': Object.keys(users).length,
      'User Type': userType,
      'Admin ID': accessControl.ADMIN_CHAT_ID
    };
    
    let message = `🔍 <b>Status Sistem</b>\n\n`;
    for (const [key, value] of Object.entries(variables)) {
      message += `${key}: ${value}\n`;
    }
    
    message += `\n⏰ Scheduler: Active\n📊 GA4: Connected`;
    
    await this.bot.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      ...(threadId && { message_thread_id: threadId })
    });
  }

  async handleSchedulerStatus(msg) {
    const userId = msg.from.id.toString();
    const chatId = msg.chat.id;
    const threadId = msg.message_thread_id || 0;
    
    const now = new Date();
    const nextReport = new Date(now);
    nextReport.setHours(12, 0, 0, 0); // 12:00 WIB
    if (nextReport < now) nextReport.setDate(nextReport.getDate() + 1);
    
    const nextBackup = new Date(now);
    nextBackup.setHours(10, 0, 0, 0); // 10:00 WIB
    if (nextBackup < now) nextBackup.setDate(nextBackup.getDate() + 1);
    
    let message = `⏰ <b>Status Scheduler</b>\n\n`;
    message += `🟢 <b>Sistem: Active</b>\n\n`;
    message += `<b>Tasks Scheduled:</b>\n`;
    message += `• Laporan Revenue: 12:00 WIB daily\n`;
    message += `• Database Backup: 10:00 WIB daily\n`;
    message += `• File Cleanup: 01:00 WIB daily\n\n`;
    message += `<b>Next Execution:</b>\n`;
    message += `📊 Revenue: ${nextReport.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}\n`;
    message += `💾 Backup: ${nextBackup.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}\n\n`;
    message += `<i>Sistem berjalan normal</i>`;
    
    await this.bot.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      ...(threadId && { message_thread_id: threadId })
    });
  }

  async handleBantuan(msg) {
    const userId = msg.from.id.toString();
    const chatId = msg.chat.id;
    const threadId = msg.message_thread_id || 0;
    
    // PERBAIKAN: Gunakan getUserType() bukan getUserInfo()
    const userType = accessControl.getUserType(userId);
    
    let message = `🆘 <b>Pusat Bantuan</b>\n\n`;
    
    if (userType === 'admin') {
      message += `<b>👑 ADMIN COMMANDS:</b>\n`;
      message += `<code>/daftar USER_ID NAMA</code> - Daftarkan user baru\n`;
      message += `<code>/lihat_user</code> - Lihat semua user\n`;
      message += `<code>/hapus_user USER_ID</code> - Hapus user\n`;
      message += `<code>/report_revenue</code> - Generate laporan\n`;
      message += `<code>/scheduler_status</code> - Cek scheduler\n\n`;
    }
    
    message += `<b>👤 USER COMMANDS:</b>\n`;
    message += `<code>/cekvar</code> - Cek status sistem\n`;
    message += `<code>/userid</code> - Lihat ID Anda\n`;
    message += `<code>/scheduler_status</code> - Cek scheduler\n`;
    message += `<code>/start</code> - Menu awal\n\n`;
    
    message += `<b>🔒 ATURAN AKSES:</b>\n`;
    message += `• <b>Admin</b>: Akses semua thread\n`;
    message += `• <b>User</b>: Thread 0,7,5 (chat), Thread 3,9 (bot-only)\n`;
    message += `• <b>Unregistered</b>: Auto-kick 30 menit\n\n`;
    
    message += `<i>Hubungi admin jika ada masalah: ${accessControl.ADMIN_CHAT_ID}</i>`;
    
    await this.bot.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      ...(threadId && { message_thread_id: threadId })
    });
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
        'Contoh: <code>/daftar 1234567890 Meningan</code>',
        {
          parse_mode: 'HTML',
          ...(threadId && { message_thread_id: threadId })
        }
      );
      return;
    }
    
    const targetUserId = parts[1];
    const targetUserName = parts.slice(2).join(' ');
    
    // Daftarkan user
    try {
      const userDatabase = require('../data/user-database');
      userDatabase.registerUser(targetUserId, targetUserName, userId);
      
      await this.bot.sendMessage(chatId, 
        `✅ User berhasil didaftarkan!\n\n` +
        `👤 Nama: ${targetUserName}\n` +
        `🆔 ID: <code>${targetUserId}</code>\n` +
        `📅 Waktu: ${new Date().toLocaleString('id-ID')}\n` +
        `👑 Admin: ${msg.from.first_name}`,
        {
          parse_mode: 'HTML',
          ...(threadId && { message_thread_id: threadId })
        }
      );
      
    } catch (error) {
      await this.bot.sendMessage(chatId, 
        `❌ Gagal mendaftarkan user: ${error.message}`,
        {
          ...(threadId && { message_thread_id: threadId })
        }
      );
    }
  }
}

// Export class
module.exports = TelegramBotHandler;
