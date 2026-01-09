// telegram-bot.js - Handler utama dengan Strict Access Control
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const accessControl = require('../utils/access-control');

class TelegramBotHandler {
  constructor() {
    console.log('🤖 TelegramBotHandler constructor called');
    this.bot = null;
    this.port = process.env.PORT || 8080;
    this.isWebhook = process.env.NODE_ENV === 'production';
    this.isInitialized = false;
    
    // JANGAN buat Express app di sini - sudah ada di index.js
    this.initializeBot();
    
    if (this.bot) {
      this.setupHandlers();
      console.log('✅ Telegram Bot Handler initialized successfully');
    }
  }

  initializeBot() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    
    if (!token) {
      console.error('❌ TELEGRAM_BOT_TOKEN tidak ditemukan di environment variables');
      console.error('   Pastikan TELEGRAM_BOT_TOKEN sudah di-set di Railway Variables');
      return;
    }
    
    // Debug: Tampilkan preview token (untuk verifikasi)
    const tokenPreview = token.length > 10 
      ? `${token.substring(0, 5)}...${token.substring(token.length - 5)}`
      : 'INVALID';
    console.log(`🔐 Token preview: ${tokenPreview}`);
    
    try {
      // FORCE POLLING MODE DULU untuk testing (lebih stabil)
      console.log('🔄 Using POLLING mode for stability');
      this.bot = new TelegramBot(token, { 
        polling: {
          interval: 300,
          autoStart: true,
          params: {
            timeout: 10
          }
        }
      });
      
      // Test connection ke Telegram API
      this.bot.getMe()
        .then(botInfo => {
          console.log(`✅ Bot connected: @${botInfo.username} (${botInfo.first_name})`);
          console.log(`   Bot ID: ${botInfo.id}`);
          this.isInitialized = true;
          
          // Set webhook jika di production (opsional)
          if (this.isWebhook) {
            this.setupWebhook();
          }
        })
        .catch(error => {
          console.error('❌ Bot token INVALID atau koneksi gagal:', error.message);
          console.error('   Periksa:');
          console.error('   1. Token benar dari @BotFather');
          console.error('   2. Bot sudah diaktifkan');
          console.error('   3. Internet connection');
        });
        
    } catch (error) {
      console.error('❌ Failed to initialize Telegram Bot:', error.message);
    }
  }

  setupWebhook() {
    if (!this.bot || !this.isWebhook) return;
    
    try {
      const webhookUrl = process.env.RENDER_EXTERNAL_URL 
        ? `${process.env.RENDER_EXTERNAL_URL}/telegram-webhook`
        : `https://${process.env.RAILWAY_STATIC_URL}/telegram-webhook`;
      
      console.log(`🔗 Setting webhook to: ${webhookUrl}`);
      
      this.bot.setWebHook(webhookUrl)
        .then(() => {
          console.log('✅ Webhook set successfully');
        })
        .catch(error => {
          console.error('❌ Failed to set webhook:', error.message);
          console.log('⚠️  Bot will continue in polling mode');
        });
    } catch (error) {
      console.error('❌ Webhook setup error:', error.message);
    }
  }

  setupHandlers() {
    if (!this.bot) {
      console.error('❌ Cannot setup handlers - bot not initialized');
      return;
    }
    
    console.log('🔧 Setting up message handlers...');
    
    // 1. Setup middleware untuk SEMUA pesan dengan Strict Access Control
    this.bot.on('message', async (msg) => {
      try {
        console.log(`📨 STRICT Filter: Message from ${msg.from?.first_name || 'unknown'} (${msg.from?.id})`);
        
        // Gunakan accessControl.checkAccess dengan callback
        await accessControl.checkAccess(this.bot, msg, async () => {
          // Akses diizinkan, proses pesan
          await this.handleMessage(msg);
        });
        
      } catch (error) {
        console.error('❌ Error in strict access control:', error.message);
      }
    });
    
    // 2. Setup command handlers (akan dipanggil dari handleMessage)
    console.log('✅ STRICT Access Control System Activated');
    console.log('🔴 Unregistered users will be AUTO-KICKED');
    console.log('👑 Admin access: Thread ALL | User access: Thread 0,7,5 | Auto-remove: Thread 3,9');
  }

  async handleMessage(msg) {
    const userId = msg.from?.id?.toString();
    const chatId = msg.chat?.id;
    const threadId = msg.message_thread_id || 0;
    const text = msg.text || '';
    const userName = msg.from?.first_name || 'User';
    
    // Skip jika pesan dari bot atau tidak ada text
    if (msg.from?.is_bot || !text) return;
    
    console.log(`🔐 STRICT Access: ${userName} (registered) in thread ${threadId}`);
    
    // Jika bukan command, hanya log saja
    if (!text.startsWith('/')) {
      console.log(`💬 User ${userName} sent message in thread ${threadId}`);
      return;
    }
    
    // Handle commands
    const command = text.split(' ')[0].split('@')[0].toLowerCase();
    console.log(`   ⏩ Processing command: ${command}`);
    
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
      case '/hapus_user':
        await this.handleHapusUser(msg);
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
      case '/report_revenue':
        await this.handleReportRevenue(msg);
        break;
      default:
        await this.handleUnknownCommand(msg, command);
        break;
    }
  }

  async handleStart(msg) {
    const userId = msg.from.id.toString();
    const userName = msg.from.first_name;
    const chatId = msg.chat.id;
    const threadId = msg.message_thread_id || 0;
    
    const isAdmin = accessControl.isAdmin(userId);
    const isRegistered = accessControl.isRegisteredUser(userId);
    
    console.log(`🤝 User ${userName} (${userId}) accessed /start command`);
    
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
    } catch (error) {
      console.error('❌ Error sending welcome message:', error.message);
    }
  }

  async handleDaftar(msg) {
    const adminId = msg.from.id.toString();
    const adminName = msg.from.first_name;
    const chatId = msg.chat.id;
    const threadId = msg.message_thread_id || 0;
    const text = msg.text || '';
    
    if (!accessControl.isAdmin(adminId)) {
      await this.bot.sendMessage(chatId, '❌ Hanya admin yang bisa mendaftarkan user', {
        ...(threadId && { message_thread_id: threadId })
      });
      return;
    }
    
    const args = text.split(' ').slice(1);
    if (args.length < 2) {
      await this.bot.sendMessage(chatId, 
        '❌ Format: /daftar USER_ID NAMA_USER\nContoh: /daftar 123456789 iwak sothil',
        { ...(threadId && { message_thread_id: threadId }) }
      );
      return;
    }
    
    const userId = args[0];
    const userName = args.slice(1).join(' ') || `user_${userId}`;
    
    const result = accessControl.registerUser(adminId, userId, userName);
    
    await this.bot.sendMessage(chatId, result.message, {
      parse_mode: 'HTML',
      ...(threadId && { message_thread_id: threadId })
    });
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

  async handleHapusUser(msg) {
    const adminId = msg.from.id.toString();
    const chatId = msg.chat.id;
    const threadId = msg.message_thread_id || 0;
    const text = msg.text || '';
    
    if (!accessControl.isAdmin(adminId)) {
      await this.bot.sendMessage(chatId, '❌ Hanya admin yang bisa menghapus user', {
        ...(threadId && { message_thread_id: threadId })
      });
      return;
    }
    
    const args = text.split(' ').slice(1);
    if (args.length < 1) {
      await this.bot.sendMessage(chatId, 
        '❌ Format: /hapus_user USER_ID\nContoh: /hapus_user 123456789',
        { ...(threadId && { message_thread_id: threadId }) }
      );
      return;
    }
    
    const targetUserId = args[0];
    const result = accessControl.removeUser(adminId, targetUserId);
    
    await this.bot.sendMessage(chatId, result.message, {
      parse_mode: 'HTML',
      ...(threadId && { message_thread_id: threadId })
    });
  }

  async handleUserid(msg) {
    const userId = msg.from.id.toString();
    const userName = msg.from.first_name;
    const chatId = msg.chat.id;
    const threadId = msg.message_thread_id || 0;
    
    const userInfo = accessControl.getUserInfo(userId);
    
    let message = `👤 <b>Profil User</b>\n\n`;
    message += `Nama: ${userName}\n`;
    message += `ID: <code>${userId}</code>\n`;
    message += `Status: ${userInfo.userType === 'admin' ? '👑 ADMIN' : '✅ TERDAFTAR'}\n`;
    message += `Thread Akses: ${userInfo.allowedThreads}\n`;
    message += `Commands: ${userInfo.allowedCommands.length} tersedia`;
    
    await this.bot.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      ...(threadId && { message_thread_id: threadId })
    });
  }

  async handleCekvar(msg) {
    const userId = msg.from.id.toString();
    const chatId = msg.chat.id;
    const threadId = msg.message_thread_id || 0;
    
    const userInfo = accessControl.getUserInfo(userId);
    const users = require('../data/users.json');
    
    const variables = {
      'Bot Status': '🟢 Online',
      'Access Control': '🔒 Active',
      'Auto-Kick': accessControl.AUTO_KICK_ENABLED ? '✅ Enabled' : '❌ Disabled',
      'Registered Users': Object.keys(users).length,
      'User Type': userInfo.userType,
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
    
    const userInfo = accessControl.getUserInfo(userId);
    
    let message = `🆘 <b>Pusat Bantuan</b>\n\n`;
    
    if (userInfo.userType === 'admin') {
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

  async handleReportRevenue(msg) {
    const userId = msg.from.id.toString();
    const chatId = msg.chat.id;
    const threadId = msg.message_thread_id || 0;
    
    if (!accessControl.isAdmin(userId)) {
      await this.bot.sendMessage(chatId, '❌ Hanya admin yang bisa menggunakan command ini', {
        ...(threadId && { message_thread_id: threadId })
      });
      return;
    }
    
    await this.bot.sendMessage(chatId, 
      '⚠️ Fitur report_revenue memerlukan integrasi dengan services/revenue-reporter.js',
      { ...(threadId && { message_thread_id: threadId }) }
    );
  }

  async handleUnknownCommand(msg, command) {
    const userId = msg.from.id.toString();
    const chatId = msg.chat.id;
    const threadId = msg.message_thread_id || 0;
    
    const userInfo = accessControl.getUserInfo(userId);
    
    if (userInfo.userType === 'unregistered') return;
    
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

// Export class, bukan instance
module.exports = TelegramBotHandler;
