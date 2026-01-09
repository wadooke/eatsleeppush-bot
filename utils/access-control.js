// utils/access-control.js - Sistem Access Control STRICT dengan Auto-Kick 30 MENIT
const fs = require('fs');
const path = require('path');

// HELPER FUNCTION: Load user database from new system
function loadUserDatabase() {
    try {
        const filePath = path.join(__dirname, '../data/users.json');
        
        // Cek jika file exists
        if (!fs.existsSync(filePath)) {
            console.warn('⚠️  users.json not found, using empty database');
            return {};
        }
        
        // Baca file
        const data = fs.readFileSync(filePath, 'utf8');
        
        // Validasi JSON
        if (!data.trim()) {
            console.warn('⚠️  users.json is empty');
            return {};
        }
        
        const parsed = JSON.parse(data);
        console.log(`✅ Loaded ${Object.keys(parsed).length} users from database`);
        return parsed;
        
    } catch (error) {
        console.error('❌ Error loading user database:', error.message);
        return {};
    }
}

// Load database ONCE at startup
let userDatabase = loadUserDatabase();

class StrictAccessControl {
  constructor() {
    // Thread IDs dari environment
    this.DISKUSI_UMUM_THREAD_ID = parseInt(process.env.DISKUSI_UMUM_THREAD_ID) || 0;
    this.APLIKASI_THREAD_ID = parseInt(process.env.APLIKASI_THREAD_ID) || 7;
    this.TUTORIAL_THREAD_ID = parseInt(process.env.TUTORIAL_THREAD_ID) || 5;
    this.LAPORAN_THREAD_ID = parseInt(process.env.LAPORAN_THREAD_ID) || 3;
    this.PENGUMUMAN_THREAD_ID = parseInt(process.env.PENGUMUMAN_THREAD_ID) || 9;
    
    // Admin ID - DEBUG DETAILED
    this.ADMIN_CHAT_ID = process.env.ADMIN_IDS || '185472876';
    console.log(`🔍 ADMIN DEBUG: ADMIN_IDS from env = "${process.env.ADMIN_IDS}"`);
    console.log(`🔍 ADMIN DEBUG: ADMIN_CHAT_ID = "${this.ADMIN_CHAT_ID}"`);
    console.log(`🔍 ADMIN DEBUG: Type = ${typeof this.ADMIN_CHAT_ID}`);
    
    this.TELEGRAM_GROUP_CHAT_ID = process.env.TELEGRAM_GROUP_CHAT_ID;
    
    // Thread permissions
    this.USER_ALLOWED_THREADS = [
      this.DISKUSI_UMUM_THREAD_ID,
      this.APLIKASI_THREAD_ID,
      this.TUTORIAL_THREAD_ID
    ];
    
    this.BOT_ONLY_THREADS = [
      this.LAPORAN_THREAD_ID,
      this.PENGUMUMAN_THREAD_ID
    ];
    
    // Auto-kick configuration - DIPERPANJANG MENJADI 30 MENIT
    this.AUTO_KICK_ENABLED = true;
    this.KICK_DELAY_MINUTES = 30; // ⏰ 30 MENIT sebelum kick
    this.KICK_DELAY_MS = this.KICK_DELAY_MINUTES * 60 * 1000;
    this.WARNING_MESSAGE = `⚠️ <b>PERINGATAN: Anda Belum Terdaftar!</b>\n\n`;
    
    // Track users yang sudah dapat warning (untuk menghindari spam)
    this.warnedUsers = new Map();
    
    console.log('🔒 STRICT Access Control Configuration:');
    console.log(`   Auto-Kick: ${this.AUTO_KICK_ENABLED ? 'ENABLED' : 'DISABLED'}`);
    console.log(`   Kick Delay: ${this.KICK_DELAY_MINUTES} minutes`);
    console.log(`   Admin: ${this.ADMIN_CHAT_ID}`);
    console.log(`   User Threads: [${this.USER_ALLOWED_THREADS.join(', ')}]`);
    console.log(`   Bot-Only Threads: [${this.BOT_ONLY_THREADS.join(', ')}]`);
    console.log(`   Database: ${Object.keys(userDatabase).length} users loaded`);
  }

  // Helper method untuk refresh database
  refreshDatabase() {
    userDatabase = loadUserDatabase();
    console.log(`🔄 Refreshed user database: ${Object.keys(userDatabase).length} users`);
  }

  /**
   * Cek apakah user adalah admin
   */
  isAdmin(userId) {
    console.log(`🔍 isAdmin CHECK: userId="${userId}", ADMIN_CHAT_ID="${this.ADMIN_CHAT_ID}"`);
    console.log(`🔍 isAdmin COMPARE: ${userId} === ${this.ADMIN_CHAT_ID} ? ${userId === this.ADMIN_CHAT_ID}`);
    console.log(`🔍 isAdmin TYPES: userId type=${typeof userId}, ADMIN_CHAT_ID type=${typeof this.ADMIN_CHAT_ID}`);
    
    // Convert both to string for comparison
    const userIdStr = String(userId);
    const adminIdStr = String(this.ADMIN_CHAT_ID);
    
    console.log(`🔍 isAdmin STR COMPARE: "${userIdStr}" === "${adminIdStr}" ? ${userIdStr === adminIdStr}`);
    
    const result = userIdStr === adminIdStr;
    console.log(`🔍 isAdmin RESULT: ${result}`);
    return result;
  }

  /**
   * Cek apakah user terdaftar
   */
  isRegisteredUser(userId) {
    console.log(`🔍 isRegisteredUser CHECK: userId="${userId}"`);
    console.log(`🔍 Database keys:`, Object.keys(userDatabase));
    
    const result = !!userDatabase[userId];
    console.log(`🔍 isRegisteredUser RESULT: ${result}`);
    return result;
  }

  /**
   * Dapatkan tipe user dengan DETAILED DEBUG
   */
  getUserType(userId) {
    console.log(`\n🔍 === getUserType START for userId="${userId}" ===`);
    
    console.log(`🔍 Step 1: Checking isAdmin...`);
    const adminCheck = this.isAdmin(userId);
    console.log(`🔍 Step 1 Result: isAdmin = ${adminCheck}`);
    
    if (adminCheck) {
      console.log(`🔍 getUserType FINAL: ADMIN`);
      return 'admin';
    }
    
    console.log(`🔍 Step 2: Checking isRegisteredUser...`);
    const registeredCheck = this.isRegisteredUser(userId);
    console.log(`🔍 Step 2 Result: isRegisteredUser = ${registeredCheck}`);
    
    if (registeredCheck) {
      console.log(`🔍 getUserType FINAL: REGISTERED`);
      return 'registered';
    }
    
    console.log(`🔍 getUserType FINAL: UNREGISTERED`);
    return 'unregistered';
  }

  /**
   * Middleware untuk check access dengan warning 30 menit - WITH DEBUG
   */
  async checkAccess(bot, msg, callback) {
    try {
      console.log(`\n🔍 === checkAccess START ===`);
      
      const userId = msg.from?.id?.toString();
      const chatId = msg.chat?.id;
      const threadId = msg.message_thread_id || 0;
      const messageText = msg.text || '';
      const userName = msg.from?.first_name || 'User';
      const isBot = msg.from?.is_bot || false;
      
      console.log(`🔍 Message details:`);
      console.log(`   User: ${userName} (${userId})`);
      console.log(`   Thread: ${threadId}`);
      console.log(`   Text: "${messageText.substring(0, 50)}..."`);
      console.log(`   isBot: ${isBot}`);
      
      if (!userId || isBot) {
        console.log(`🔍 Skipping: no userId or is bot`);
        return callback(); // Skip untuk bot
      }
      
      // Tentukan user type
      const userType = this.getUserType(userId);
      console.log(`🔍 User type determined: ${userType}`);
      
      console.log(`🔐 STRICT Access: ${userName} (${userType}) in thread ${threadId}`);
      
      // UNREGISTERED USER: BLOCK & SCHEDULE KICK 30 MENIT
      if (userType === 'unregistered') {
        console.log(`🚫 Unregistered user ${userName} (${userId}) attempted to interact`);
        
        // 1. Kirim warning message (tidak spam)
        await this.sendWarningMessage(bot, msg, userName, userId);
        
        // 2. Schedule auto-kick 30 menit jika belum di-schedule
        if (this.AUTO_KICK_ENABLED && this.TELEGRAM_GROUP_CHAT_ID && !this.warnedUsers.get(`${userId}_kick_scheduled`)) {
          this.warnedUsers.set(`${userId}_kick_scheduled`, true);
          this.kickUser(bot, this.TELEGRAM_GROUP_CHAT_ID, userId, userName);
        }
        
        // 3. Hapus pesan user
        try {
          await bot.deleteMessage(chatId, msg.message_id).catch(() => {});
        } catch (e) {}
        
        console.log(`🔍 checkAccess END: Blocked unregistered user`);
        return; // BLOCK akses total
      }
      
      console.log(`🔍 User is ${userType}, checking thread access...`);
      
      // Untuk REGISTERED & ADMIN: cek thread permission
      const accessResult = this.checkThreadAccess(userId, threadId);
      console.log(`🔍 Thread access result:`, accessResult);
      
      if (!accessResult.allowed) {
        console.log(`🔍 Access NOT allowed: ${accessResult.reason}`);
        
        // AUTO-REMOVE untuk user di thread bot-only (3,9) - SILENT MODE
        if (accessResult.reason === 'bot_only_thread') {
          console.log(`🔇 Auto-remove silent for thread ${threadId}`);
          try {
            await bot.deleteMessage(chatId, msg.message_id).catch(() => {});
          } catch (e) {}
          console.log(`🔍 checkAccess END: Auto-remove silent`);
          return; // Hapus pesan tanpa warning
        }
        
        // Kirim warning untuk alasan lain
        if (!accessResult.silent && userType === 'registered') {
          console.log(`⚠️ Sending warning for thread ${threadId}`);
          await this.sendAccessDeniedMessage(bot, msg, userType, threadId);
        }
        console.log(`🔍 checkAccess END: Denied with${accessResult.silent ? 'out' : ''} warning`);
        return;
      }
      
      console.log(`✅ Access allowed, executing callback`);
      // Akses diizinkan, lanjutkan ke callback
      return callback();
      
    } catch (error) {
      console.error('❌ Error in strict access control:', error.message);
      console.error(error.stack);
      return; // Default deny untuk safety
    }
  }

  /**
   * Cek akses berdasarkan thread - WITH DEBUG
   */
  checkThreadAccess(userId, threadId) {
    console.log(`🔍 checkThreadAccess: userId="${userId}", threadId=${threadId}`);
    
    const userType = this.getUserType(userId);
    console.log(`🔍 User type in thread check: ${userType}`);
    
    // 1. ADMIN: Access to ALL threads
    if (userType === 'admin') {
      console.log(`✅ ADMIN ACCESS GRANTED for thread ${threadId}`);
      return { allowed: true, reason: 'admin_full_access' };
    }
    
    // 2. REGISTERED USER:
    if (userType === 'registered') {
      console.log(`🔍 Registered user checking threads...`);
      console.log(`🔍 USER_ALLOWED_THREADS: [${this.USER_ALLOWED_THREADS.join(', ')}]`);
      console.log(`🔍 BOT_ONLY_THREADS: [${this.BOT_ONLY_THREADS.join(', ')}]`);
      console.log(`🔍 Current thread: ${threadId}`);
      
      // a) Auto-remove SILENT dari bot-only threads (3,9)
      if (this.BOT_ONLY_THREADS.includes(threadId)) {
        console.log(`🔍 Thread ${threadId} is BOT-ONLY, auto-remove silent`);
        return { 
          allowed: false, 
          reason: 'bot_only_thread',
          silent: true
        };
      }
      
      // b) Allow in user threads (0,7,5)
      if (this.USER_ALLOWED_THREADS.includes(threadId)) {
        console.log(`✅ User allowed in thread ${threadId}`);
        return { allowed: true, reason: 'user_in_allowed_thread' };
      }
      
      // c) Deny untuk thread lain dengan warning
      console.log(`🔍 Thread ${threadId} not in allowed threads`);
      return { 
        allowed: false, 
        reason: 'thread_not_allowed',
        silent: false
      };
    }
    
    console.log(`❌ User type ${userType} not recognized`);
    return { allowed: false, reason: 'unregistered_user' };
  }

  /**
   * TEMPORARY: Bypass untuk testing - Ganti fungsi checkAccess dengan versi ini
   */
  async checkAccess_TESTING(bot, msg, callback) {
    console.log(`🚨 TEMPORARY BYPASS: Allowing ALL messages for testing`);
    console.log(`📨 Message from ${msg.from?.first_name} (${msg.from?.id}): "${msg.text?.substring(0, 50)}..."`);
    
    // Langsung execute callback tanpa pengecekan
    return callback();
  }

  /**
   * Schedule auto-kick untuk unregistered user setelah 30 menit
   */
  async kickUser(bot, groupChatId, userId, userName) {
    console.log(`⏰ Scheduling auto-kick for ${userName} (${userId}) in ${this.KICK_DELAY_MINUTES} minutes`);
    
    setTimeout(async () => {
      try {
        // Refresh database dulu sebelum kick (mungkin sudah terdaftar)
        this.refreshDatabase();
        
        if (this.isRegisteredUser(userId) || this.isAdmin(userId)) {
          console.log(`✅ User ${userName} (${userId}) now registered/admin, cancelling kick`);
          return;
        }
        
        console.log(`🚫 Executing auto-kick for unregistered user ${userName} (${userId})`);
        
        // Try to kick from group
        await bot.banChatMember(groupChatId, userId).catch(err => {
          console.log(`⚠️  Could not kick ${userName}: ${err.message}`);
        });
        
        // Send final notification
        const kickMessage = `🚫 <b>USER DIKELUARKAN OTOMATIS</b>\n\n` +
                           `👤 <b>User:</b> ${userName}\n` +
                           `🆔 <b>ID:</b> <code>${userId}</code>\n` +
                           `⏰ <b>Waktu:</b> ${this.KICK_DELAY_MINUTES} menit sejak warning pertama\n` +
                           `📅 <b>Tanggal:</b> ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}\n\n` +
                           `<i>Sistem Strict Access Control - Auto-kick untuk unregistered user</i>`;
        
        await bot.sendMessage(groupChatId, kickMessage, {
          parse_mode: 'HTML'
        }).catch(() => {});
        
        console.log(`✅ Auto-kick completed for ${userName} (${userId})`);
        
      } catch (error) {
        console.error('❌ Error in auto-kick:', error.message);
      }
    }, this.KICK_DELAY_MS);
  }

  /**
   * Kirim warning message ke unregistered user
   */
  async sendWarningMessage(bot, msg, userName, userId) {
    const chatId = msg.chat?.id;
    const threadId = msg.message_thread_id || 0;
    
    console.log(`🔍 sendWarningMessage: ${userName} (${userId}) in thread ${threadId}`);
    
    // Cek apakah user sudah dapat warning
    if (this.warnedUsers.has(userId)) {
      const lastWarning = this.warnedUsers.get(userId);
      const timeSinceWarning = Date.now() - lastWarning;
      
      // Jangan spam warning, minimal 5 menit
      if (timeSinceWarning < 5 * 60 * 1000) {
        console.log(`🔍 Skipping warning (already warned recently)`);
        return;
      }
    }
    
    // Update waktu warning terakhir
    this.warnedUsers.set(userId, Date.now());
    
    const warningMessage = 
      `⚠️ <b>PERINGATAN: Anda Belum Terdaftar!</b>\n\n` +
      `👤 <b>User:</b> ${userName}\n` +
      `🆔 <b>ID Anda:</b> <code>${userId}</code>\n\n` +
      `❌ <b>Anda TIDAK BISA:</b>\n` +
      `• Mengirim pesan atau gambar\n` +
      `• Menggunakan command apapun\n` +
      `• Berinteraksi di grup\n\n` +
      `✅ <b>Yang harus dilakukan:</b>\n` +
      `1. Hubungi Admin: <code>${this.ADMIN_CHAT_ID}</code>\n` +
      `2. Minta untuk didaftarkan\n` +
      `3. Tunggu konfirmasi\n\n` +
      `⏰ <b>WARNING:</b> Anda akan otomatis dikeluarkan dalam <b>${this.KICK_DELAY_MINUTES} menit</b> jika belum terdaftar!\n\n` +
      `<i>Status: BELUM TERDAFTAR - ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</i>`;
    
    try {
      await bot.sendMessage(chatId, warningMessage, {
        parse_mode: 'HTML',
        ...(threadId && { message_thread_id: threadId })
      });
      
      console.log(`⚠️  Warning sent to unregistered user ${userName} (${userId})`);
      
    } catch (error) {
      console.error('❌ Failed to send warning message:', error.message);
    }
  }

  /**
   * Kirim pesan access denied untuk registered user
   */
  async sendAccessDeniedMessage(bot, msg, userType, threadId) {
    const chatId = msg.chat?.id;
    const thread = threadId || 0;
    
    console.log(`🔍 sendAccessDeniedMessage: ${userType} in thread ${thread}`);
    
    // Hanya kirim warning untuk registered user di thread selain 3,9
    if (userType === 'registered' && !this.BOT_ONLY_THREADS.includes(thread)) {
      const message = `❌ <b>Akses Ditolak untuk User Terdaftar</b>\n\n` +
                      `Aturan penggunaan:\n` +
                      `✅ <b>Command yang diizinkan:</b> /cekvar, /userid\n` +
                      `✅ <b>Bisa kirim pesan/gambar di:</b> Thread ${this.USER_ALLOWED_THREADS.join(', ')}\n\n` +
                      `<i>Anda saat ini di thread ID: ${thread}</i>`;
      
      try {
        await bot.sendMessage(chatId, message, {
          parse_mode: 'HTML',
          ...(thread && { message_thread_id: thread })
        });
        console.log(`📨 Access denied message sent`);
      } catch (error) {
        console.error('❌ Failed to send access denied message:', error.message);
      }
    }
  }
}

// 🚨 OPTIONAL: Ganti dengan bypass untuk testing
const instance = new StrictAccessControl();

// Untuk testing, ganti checkAccess dengan bypass version
// instance.checkAccess = instance.checkAccess_TESTING;

module.exports = instance;
