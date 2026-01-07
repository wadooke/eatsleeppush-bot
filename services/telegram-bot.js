// telegram-bot.js - Handler utama dengan Strict Access Control
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const accessControl = require('../utils/access-control');

class TelegramBotHandler {
  constructor() {
    this.bot = null;
    this.app = express();
    this.port = process.env.PORT || 8080;
    this.isWebhook = process.env.NODE_ENV === 'production';
    
    this.setupExpress();
    this.initializeBot();
    this.setupHandlers();
  }

  setupExpress() {
    this.app.use(express.json());
    
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });
    
    // User list endpoint
    this.app.get('/users', (req, res) => {
      const users = Object.entries(require('./data/users.json')).map(([id, data]) => ({
        id,
        name: data.name || data.username,
        registeredAt: data.registeredAt,
        status: data.status
      }));
      res.json({ users });
    });
    
    this.app.listen(this.port, () => {
      console.log(`🌐 Server bot berjalan di port ${this.port}`);
      console.log(`🔗 Health check: http://localhost:${this.port}/health`);
      console.log(`🔗 Users: http://localhost:${this.port}/users`);
    });
  }

  initializeBot() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    
    if (!token) {
      console.error('❌ TELEGRAM_BOT_TOKEN tidak ditemukan di environment variables');
      process.exit(1);
    }
    
    if (this.isWebhook) {
      // Webhook mode untuk production
      this.bot = new TelegramBot(token);
      this.bot.setWebHook(`${process.env.RENDER_EXTERNAL_URL}/telegram-webhook`);
      console.log('🔗 Webhook mode diaktifkan');
    } else {
      // Polling mode untuk development
      this.bot = new TelegramBot(token, { polling: true });
      console.log('🔄 Polling mode diaktifkan');
    }
    
    console.log('🤖 Bot initialized:', this.bot.options.username);
  }

  setupHandlers() {
    // Setup webhook endpoint untuk production
    if (this.isWebhook) {
      this.app.post('/telegram-webhook', (req, res) => {
        this.bot.processUpdate(req.body);
        res.sendStatus(200);
      });
    }
    
    // Middleware untuk SEMUA pesan (termasuk commands)
    this.bot.on('message', async (msg) => {
      try {
        await accessControl.checkAccess(this.bot, msg, async () => {
          // Akses diizinkan, proses pesan
          await this.handleMessage(msg);
        });
      } catch (error) {
        console.error('❌ Error in message handler:', error.message);
      }
    });
    
    // Handler untuk callback queries (untuk button, dll)
    this.bot.on('callback_query', async (callbackQuery) => {
      try {
        const msg = callbackQuery.message;
        const userId = callbackQuery.from.id.toString();
        
        // Check access untuk callback query
        await accessControl.checkAccess(this.bot, msg, async () => {
          await this.handleCallbackQuery(callbackQuery);
        });
      } catch (error) {
        console.error('❌ Error in callback query handler:', error.message);
      }
    });
    
    // Setup command handlers
    this.setupCommandHandlers();
    
    console.log('✅ STRICT Access Control System Activated');
    console.log('🔴 Unregistered users will be AUTO-KICKED');
  }

  async handleMessage(msg) {
    const userId = msg.from?.id.toString();
    const chatId = msg.chat?.id;
    const threadId = msg.message_thread_id || 0;
    const text = msg.text || '';
    const userName = msg.from?.first_name || 'User';
    
    // Skip jika pesan dari bot atau tidak ada text
    if (msg.from?.is_bot || !text) return;
    
    console.log(`📨 Message from ${userName} (${userId}) in thread ${threadId}: ${text.substring(0, 50)}...`);
    
    // Jika bukan command, hanya log saja (karena access control sudah memfilter)
    if (!text.startsWith('/')) {
      console.log(`💬 User ${userName} sent message in thread ${threadId}`);
      return;
    }
    
    // Commands akan ditangani oleh handler terpisah
  }

  async handleCallbackQuery(callbackQuery) {
    const data = callbackQuery.data;
    const userId = callbackQuery.from.id.toString();
    const userName = callbackQuery.from.first_name;
    
    console.log(`🔄 Callback query from ${userName} (${userId}): ${data}`);
    
    // Acknowledge callback query
    await this.bot.answerCallbackQuery(callbackQuery.id).catch(() => {});
  }

  setupCommandHandlers() {
    // ========== ADMIN COMMANDS ==========
    
    // /start - Welcome message untuk semua user
    this.bot.onText(/\/start/, async (msg) => {
      const userId = msg.from.id.toString();
      const userName = msg.from.first_name;
      const chatId = msg.chat.id;
      const threadId = msg.message_thread_id || 0;
      
      const isAdmin = accessControl.isAdmin(userId);
      const isRegistered = accessControl.isRegisteredUser(userId);
      
      console.log(`🤝 User ${userName} (${userId}) accessed /start command`);
      
      let welcomeMessage = `Halo ${userName}! 👋\n\n`;
      welcomeMessage += `Selamat datang di EatSleepPush GA4 Bot.\n\n`;
      
      if (isAdmin) {
        welcomeMessage += `👑 <b>Status: ADMIN</b>\n`;
        welcomeMessage += `✅ Anda memiliki akses penuh di semua thread\n\n`;
        welcomeMessage += `<b>Commands Admin:</b>\n`;
        welcomeMessage += `/daftar USER_ID NAMA - Daftarkan user baru\n`;
        welcomeMessage += `/lihat_user - Lihat semua user terdaftar\n`;
        welcomeMessage += `/hapus_user USER_ID - Hapus user\n`;
        welcomeMessage += `/report_revenue - Generate laporan revenue\n`;
        welcomeMessage += `/scheduler_status - Cek status scheduler\n`;
      } else if (isRegistered) {
        welcomeMessage += `✅ <b>Status: USER TERDAFTAR</b>\n`;
        welcomeMessage += `📝 Anda bisa mengirim pesan di thread: 0, 7, 5\n`;
        welcomeMessage += `❌ Tidak bisa akses thread: 3, 9 (bot-only)\n\n`;
        welcomeMessage += `<b>Commands User:</b>\n`;
        welcomeMessage += `/cekvar - Cek variabel\n`;
        welcomeMessage += `/userid - Lihat ID Anda\n`;
        welcomeMessage += `/profil - Lihat profil Anda\n`;
        welcomeMessage += `/scheduler_status - Cek status scheduler\n`;
      } else {
        welcomeMessage += `❌ <b>Status: BELUM TERDAFTAR</b>\n`;
        welcomeMessage += `⏰ Anda akan otomatis dikeluarkan dalam 30 menit\n`;
        welcomeMessage += `Hubungi admin untuk pendaftaran: ${accessControl.ADMIN_CHAT_ID}\n`;
      }
      
      welcomeMessage += `\n🔒 <i>Sistem Strict Access Control aktif</i>`;
      
      try {
        await this.bot.sendMessage(chatId, welcomeMessage, {
          parse_mode: 'HTML',
          message_thread_id: threadId || undefined
        });
      } catch (error) {
        console.error('❌ Error sending welcome message:', error.message);
      }
    });
    
    // /daftar - Admin only: Daftarkan user baru
    this.bot.onText(/\/daftar (.+)/, async (msg, match) => {
      const adminId = msg.from.id.toString();
      const adminName = msg.from.first_name;
      const chatId = msg.chat.id;
      const threadId = msg.message_thread_id || 0;
      
      if (!accessControl.isAdmin(adminId)) {
        await this.bot.sendMessage(chatId, '❌ Hanya admin yang bisa mendaftarkan user', {
          message_thread_id: threadId || undefined
        });
        return;
      }
      
      const args = match[1].split(' ');
      const userId = args[0];
      const userName = args.slice(1).join(' ') || `user_${userId}`;
      
      const result = accessControl.registerUser(adminId, userId, userName);
      
      await this.bot.sendMessage(chatId, result.message, {
        parse_mode: 'HTML',
        message_thread_id: threadId || undefined
      });
      
      // Kirim notifikasi ke user yang didaftarkan
      if (result.success) {
        try {
          await this.bot.sendMessage(userId, 
            `✅ Anda telah terdaftar di EatSleepPush GA4 Bot oleh admin ${adminName}!\n\n` +
            `Sekarang Anda bisa:\n` +
            `• Mengirim pesan di thread 0, 7, 5\n` +
            `• Menggunakan commands user\n` +
            `• Tidak akan dikick dari grup\n\n` +
            `Selamat bergabung! 🎉`
          );
        } catch (error) {
          console.log(`ℹ️  User ${userId} mungkin belum memulai chat dengan bot`);
        }
      }
    });
    
    // /lihat_user - Admin only: Lihat daftar user
    this.bot.onText(/\/lihat_user/, async (msg) => {
      const userId = msg.from.id.toString();
      const chatId = msg.chat.id;
      const threadId = msg.message_thread_id || 0;
      
      if (!accessControl.isAdmin(userId)) {
        await this.bot.sendMessage(chatId, '❌ Hanya admin yang bisa melihat daftar user', {
          message_thread_id: threadId || undefined
        });
        return;
      }
      
      const users = require('./data/users.json');
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
        message_thread_id: threadId || undefined
      });
    });
    
    // /hapus_user - Admin only: Hapus user
    this.bot.onText(/\/hapus_user (.+)/, async (msg, match) => {
      const adminId = msg.from.id.toString();
      const chatId = msg.chat.id;
      const threadId = msg.message_thread_id || 0;
      const targetUserId = match[1];
      
      if (!accessControl.isAdmin(adminId)) {
        await this.bot.sendMessage(chatId, '❌ Hanya admin yang bisa menghapus user', {
          message_thread_id: threadId || undefined
        });
        return;
      }
      
      const result = accessControl.removeUser(adminId, targetUserId);
      
      await this.bot.sendMessage(chatId, result.message, {
        parse_mode: 'HTML',
        message_thread_id: threadId || undefined
      });
    });
    
    // ========== USER COMMANDS ==========
    
    // /userid - Show user's ID
    this.bot.onText(/\/userid/, async (msg) => {
      const userId = msg.from.id.toString();
      const userName = msg.from.first_name;
      const chatId = msg.chat.id;
      const threadId = msg.message_thread_id || 0;
      
      const userInfo = accessControl.getUserInfo(userId);
      
      if (userInfo.userType === 'unregistered') {
        return; // Sudah ditangani oleh access control
      }
      
      let message = `👤 <b>Profil User</b>\n\n`;
      message += `Nama: ${userName}\n`;
      message += `ID: <code>${userId}</code>\n`;
      message += `Status: ${userInfo.userType === 'admin' ? '👑 ADMIN' : '✅ TERDAFTAR'}\n`;
      message += `Thread Akses: ${userInfo.allowedThreads}\n`;
      message += `Commands: ${userInfo.allowedCommands.length} tersedia`;
      
      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'HTML',
        message_thread_id: threadId || undefined
      });
    });
    
    // /cekvar - User command untuk cek variabel
    this.bot.onText(/\/cekvar/, async (msg) => {
      const userId = msg.from.id.toString();
      const chatId = msg.chat.id;
      const threadId = msg.message_thread_id || 0;
      
      const userInfo = accessControl.getUserInfo(userId);
      
      if (userInfo.userType === 'unregistered') {
        return; // Sudah ditangani oleh access control
      }
      
      // Contoh: Tampilkan beberapa variabel environment (non-sensitive)
      const variables = {
        'Bot Status': '🟢 Online',
        'Access Control': '🔒 Active',
        'Auto-Kick': accessControl.AUTO_KICK_ENABLED ? '✅ Enabled' : '❌ Disabled',
        'Registered Users': Object.keys(require('./data/users.json')).length,
        'User Type': userInfo.userType
      };
      
      let message = `🔍 <b>Status Sistem</b>\n\n`;
      for (const [key, value] of Object.entries(variables)) {
        message += `${key}: ${value}\n`;
      }
      
      message += `\n⏰ Scheduler: Active\n📊 GA4: Connected`;
      
      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'HTML',
        message_thread_id: threadId || undefined
      });
    });
    
    // ========== SYSTEM COMMANDS ==========
    
    // /scheduler_status - Cek status scheduler
    this.bot.onText(/\/scheduler_status/, async (msg) => {
      const userId = msg.from.id.toString();
      const chatId = msg.chat.id;
      const threadId = msg.message_thread_id || 0;
      
      const userInfo = accessControl.getUserInfo(userId);
      
      if (userInfo.userType === 'unregistered') {
        return; // Sudah ditangani oleh access control
      }
      
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
        message_thread_id: threadId || undefined
      });
    });
    
    // /bantuan - Tampilkan help message
    this.bot.onText(/\/bantuan/, async (msg) => {
      const userId = msg.from.id.toString();
      const chatId = msg.chat.id;
      const threadId = msg.message_thread_id || 0;
      
      const userInfo = accessControl.getUserInfo(userId);
      
      if (userInfo.userType === 'unregistered') {
        return; // Sudah ditangani oleh access control
      }
      
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
        message_thread_id: threadId || undefined
      });
    });
    
    // Handle unknown commands
    this.bot.onText(/\/(.+)/, async (msg, match) => {
      const command = match[1];
      const userId = msg.from.id.toString();
      const chatId = msg.chat.id;
      const threadId = msg.message_thread_id || 0;
      
      const userInfo = accessControl.getUserInfo(userId);
      
      // Skip jika unregistered (sudah ditangani access control)
      if (userInfo.userType === 'unregistered') return;
      
      // Cek jika command tidak dikenali
      const knownCommands = [...userInfo.allowedCommands.map(cmd => cmd.replace('/', ''))];
      if (!knownCommands.includes(command.split(' ')[0])) {
        await this.bot.sendMessage(chatId, 
          `❌ Command <code>/${command}</code> tidak dikenali.\n` +
          `Gunakan <code>/bantuan</code> untuk melihat commands yang tersedia.`,
          {
            parse_mode: 'HTML',
            message_thread_id: threadId || undefined
          }
        );
      }
    });
  }

  // Method untuk mengirim pesan ke thread tertentu
  async sendToThread(threadId, message, options = {}) {
    try {
      if (!this.bot) return false;
      
      const chatId = process.env.TELEGRAM_GROUP_CHAT_ID;
      if (!chatId) {
        console.error('❌ TELEGRAM_GROUP_CHAT_ID not set');
        return false;
      }
      
      const result = await this.bot.sendMessage(chatId, message, {
        message_thread_id: threadId,
        parse_mode: 'HTML',
        ...options
      });
      
      return result;
    } catch (error) {
      console.error(`❌ Error sending to thread ${threadId}:`, error.message);
      return false;
    }
  }

  // Method untuk broadcast ke semua user
  async broadcastToUsers(message, options = {}) {
    try {
      const users = require('./data/users.json');
      let successCount = 0;
      let failCount = 0;
      
      for (const userId of Object.keys(users)) {
        try {
          await this.bot.sendMessage(userId, message, {
            parse_mode: 'HTML',
            ...options
          });
          successCount++;
        } catch (error) {
          failCount++;
          console.log(`ℹ️  Could not send to user ${userId}:`, error.message);
        }
      }
      
      return { success: successCount, failed: failCount };
    } catch (error) {
      console.error('❌ Error in broadcast:', error.message);
      return { success: 0, failed: 0 };
    }
  }
}

// Export singleton instance
module.exports = new TelegramBotHandler();
