// utils/access-control.js - Sistem Access Control STRICT dengan Auto-Kick 30 MENIT
const userDatabase = require('../data/user-database');

class StrictAccessControl {
  constructor() {
    // Thread IDs dari environment
    this.DISKUSI_UMUM_THREAD_ID = parseInt(process.env.DISKUSI_UMUM_THREAD_ID) || 0;
    this.APLIKASI_THREAD_ID = parseInt(process.env.APLIKASI_THREAD_ID) || 7;
    this.TUTORIAL_THREAD_ID = parseInt(process.env.TUTORIAL_THREAD_ID) || 5;
    this.LAPORAN_THREAD_ID = parseInt(process.env.LAPORAN_THREAD_ID) || 3;
    this.PENGUMUMAN_THREAD_ID = parseInt(process.env.PENGUMUMAN_THREAD_ID) || 9;
    
    // Admin ID
    this.ADMIN_CHAT_ID = process.env.ADMIN_IDS || '185472876';
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
  }

  /**
   * Cek apakah user adalah admin
   */
  isAdmin(userId) {
    return userId === this.ADMIN_CHAT_ID;
  }

  /**
   * Cek apakah user terdaftar
   */
  isRegisteredUser(userId) {
    return !!userDatabase.users[userId];
  }

  /**
   * Kick user dari group dengan delay 30 menit
   */
  async kickUser(bot, chatId, userId, userName) {
    try {
      console.log(`🚫 Scheduling kick for user ${userName} (${userId}) in ${this.KICK_DELAY_MINUTES} minutes`);
      
      // Schedule kick setelah 30 menit
      setTimeout(async () => {
        try {
          // Cek ulang apakah user sudah terdaftar selama 30 menit ini
          if (this.isRegisteredUser(userId)) {
            console.log(`✅ User ${userId} sudah terdaftar, canceling kick`);
            return;
          }
          
          console.log(`⏰ Executing scheduled kick for user ${userId}`);
          
          // 1. Kirim final warning
          await bot.sendMessage(chatId,
            `⏰ <b>WAKTU HABIS!</b>\n\n` +
            `User <b>${userName}</b> belum didaftarkan dalam ${this.KICK_DELAY_MINUTES} menit.\n` +
            `❌ Anda akan dikeluarkan dari grup.\n\n` +
            `<i>Hubungi admin untuk bergabung kembali setelah terdaftar.</i>`,
            {
              parse_mode: 'HTML'
            }
          ).catch(() => {});
          
          // Tunggu 5 detik sebelum kick
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          // 2. Ban user sementara
          await bot.banChatMember(chatId, userId, {
            until_date: Math.floor(Date.now() / 1000) + 3600 // Ban 1 jam
          }).catch(() => {});
          
          console.log(`✅ User ${userName} (${userId}) kicked after ${this.KICK_DELAY_MINUTES} minutes delay`);
          
          // 3. Kirim notifikasi ke admin
          await this.notifyAdmin(bot, userName, userId);
          
        } catch (error) {
          console.error(`❌ Error executing kick for ${userId}:`, error.message);
        }
      }, this.KICK_DELAY_MS);
      
    } catch (error) {
      console.error(`❌ Failed to schedule kick for user ${userId}:`, error.message);
    }
  }

  /**
   * Notifikasi ke admin tentang user yang di-kick
   */
  async notifyAdmin(bot, userName, userId) {
    try {
      const adminMessage = 
        `👮 <b>ADMIN NOTIFICATION: User Di-Kick</b>\n\n` +
        `👤 <b>User:</b> ${userName}\n` +
        `🆔 <b>ID:</b> <code>${userId}</code>\n` +
        `⏰ <b>Waktu:</b> ${new Date().toLocaleString('id-ID')}\n` +
        `📅 <b>Alasan:</b> Belum terdaftar setelah ${this.KICK_DELAY_MINUTES} menit\n\n` +
        `<i>User bisa bergabung kembali setelah didaftarkan dengan /daftar ${userId}</i>`;
      
      await bot.sendMessage(this.ADMIN_CHAT_ID, adminMessage, {
        parse_mode: 'HTML'
      });
      
    } catch (error) {
      console.error('❌ Failed to notify admin:', error.message);
    }
  }

  /**
   * Kirim warning message ke unregistered user
   */
  async sendWarningMessage(bot, msg, userName, userId) {
    const chatId = msg.chat?.id;
    const threadId = msg.message_thread_id || 0;
    
    // Cek apakah user sudah dapat warning
    if (this.warnedUsers.has(userId)) {
      const lastWarning = this.warnedUsers.get(userId);
      const timeSinceWarning = Date.now() - lastWarning;
      
      // Jangan spam warning, minimal 5 menit
      if (timeSinceWarning < 5 * 60 * 1000) {
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
   * Middleware untuk check access dengan warning 30 menit
   */
  async checkAccess(bot, msg, callback) {
    try {
      const userId = msg.from?.id?.toString();
      const chatId = msg.chat?.id;
      const threadId = msg.message_thread_id || 0;
      const messageText = msg.text || '';
      const userName = msg.from?.first_name || 'User';
      const isBot = msg.from?.is_bot || false;
      
      if (!userId || isBot) {
        return callback(); // Skip untuk bot
      }
      
      // Tentukan user type
      const userType = this.getUserType(userId);
      
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
        
        return; // BLOCK akses total
      }
      
      // Untuk REGISTERED & ADMIN: cek thread permission
      const accessResult = this.checkThreadAccess(userId, threadId);
      
      if (!accessResult.allowed) {
        // AUTO-REMOVE untuk user di thread bot-only (3,9) - SILENT MODE
        if (accessResult.reason === 'bot_only_thread') {
          try {
            await bot.deleteMessage(chatId, msg.message_id).catch(() => {});
          } catch (e) {}
          return; // Hapus pesan tanpa warning
        }
        
        // Kirim warning untuk alasan lain
        if (!accessResult.silent && userType === 'registered') {
          await this.sendAccessDeniedMessage(bot, msg, userType, threadId);
        }
        return;
      }
      
      // Akses diizinkan, lanjutkan ke callback
      return callback();
      
    } catch (error) {
      console.error('❌ Error in strict access control:', error.message);
      return; // Default deny untuk safety
    }
  }

  /**
   * Cek akses berdasarkan thread
   */
  checkThreadAccess(userId, threadId) {
    const userType = this.getUserType(userId);
    
    // 1. ADMIN: Access to ALL threads
    if (userType === 'admin') {
      return { allowed: true, reason: 'admin_full_access' };
    }
    
    // 2. REGISTERED USER:
    if (userType === 'registered') {
      // a) Auto-remove SILENT dari bot-only threads (3,9)
      if (this.BOT_ONLY_THREADS.includes(threadId)) {
        return { 
          allowed: false, 
          reason: 'bot_only_thread',
          silent: true  // NO WARNING MESSAGE
        };
      }
      
      // b) Allow in user threads (0,7,5)
      if (this.USER_ALLOWED_THREADS.includes(threadId)) {
        return { allowed: true, reason: 'user_in_allowed_thread' };
      }
      
      // c) Deny untuk thread lain dengan warning
      return { 
        allowed: false, 
        reason: 'thread_not_allowed',
        silent: false  // Show warning
      };
    }
    
    return { allowed: false, reason: 'unregistered_user' };
  }

  /**
   * Cek apakah command diizinkan
   */
  isCommandAllowed(command, userId, threadId) {
    const userType = this.getUserType(userId);
    const commandName = command.split(' ')[0].split('@')[0];
    
    // 1. Bot bisa semua command
    if (userType === 'bot') return true;
    
    // 2. UNREGISTERED USER: TIDAK BISA APA-APA
    if (userType === 'unregistered') return false;
    
    // 3. ADMIN: Bisa semua command di SEMUA thread
    if (userType === 'admin') return true;
    
    // 4. USER TERDAFTAR: 
    // Hanya command tertentu di thread user (0,7,5)
    if (userType === 'registered') {
      // Cek apakah di thread yang diizinkan
      if (!this.USER_ALLOWED_THREADS.includes(threadId)) {
        return false;
      }
      
      // Command yang diizinkan untuk user
      const userCommands = [
        '/cekvar', '/userid', '/profil', '/cekvar_stats',
        '/start', '/scheduler_status', '/bantuan'
      ];
      
      return userCommands.includes(commandName);
    }
    
    return false;
  }

  /**
   * Cek apakah user bisa kirim pesan/gambar
   * (Fungsi ini masih digunakan oleh beberapa bagian kode)
   */
  canSendMessage(userId, threadId) {
    const accessResult = this.checkThreadAccess(userId, threadId);
    return accessResult.allowed;
  }

  /**
   * Dapatkan tipe user
   */
  getUserType(userId) {
    if (this.isAdmin(userId)) return 'admin';
    if (this.isRegisteredUser(userId)) return 'registered';
    return 'unregistered';
  }

  /**
   * Kirim pesan access denied untuk registered user
   * (Hanya untuk kasus khusus, tidak untuk thread 3,9)
   */
  async sendAccessDeniedMessage(bot, msg, userType, threadId) {
    const chatId = msg.chat?.id;
    const thread = threadId || 0;
    
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
      } catch (error) {
        console.error('❌ Failed to send access denied message:', error.message);
      }
    }
  }

  /**
   * Daftarkan user baru (hanya admin) - CANCEL scheduled kick
   */
  registerUser(adminId, userId, username) {
    if (!this.isAdmin(adminId)) {
      return { success: false, message: 'Hanya admin yang bisa mendaftarkan user' };
    }
    
    try {
      // Cancel any scheduled kick untuk user ini
      this.warnedUsers.delete(`${userId}_kick_scheduled`);
      
      // Update database
      userDatabase.users[userId] = {
        username: username || `user_${userId}`,
        registeredAt: new Date().toISOString(),
        registeredBy: adminId,
        warningCleared: true
      };
      
      // Save to file (jika diperlukan)
      userDatabase.saveToFile && userDatabase.saveToFile();
      
      console.log(`✅ User ${userId} registered by admin ${adminId} - Kick canceled`);
      
      return { 
        success: true, 
        message: `User ${username || userId} berhasil didaftarkan\n⏰ Scheduled kick dibatalkan`,
        user: userDatabase.users[userId]
      };
      
    } catch (error) {
      console.error('❌ Failed to register user:', error);
      return { success: false, message: 'Gagal mendaftarkan user' };
    }
  }

  /**
   * Hapus user (hanya admin)
   */
  removeUser(adminId, userId) {
    if (!this.isAdmin(adminId)) {
      return { success: false, message: 'Hanya admin yang bisa menghapus user' };
    }
    
    if (!userDatabase.users[userId]) {
      return { success: false, message: 'User tidak ditemukan' };
    }
    
    try {
      const username = userDatabase.users[userId].username;
      delete userDatabase.users[userId];
      
      // Save to file (jika diperlukan)
      userDatabase.saveToFile && userDatabase.saveToFile();
      
      console.log(`🗑️ User ${userId} removed by admin ${adminId}`);
      
      return { 
        success: true, 
        message: `User ${username} berhasil dihapus`
      };
      
    } catch (error) {
      console.error('❌ Failed to remove user:', error);
      return { success: false, message: 'Gagal menghapus user' };
    }
  }

  /**
   * Get user info
   */
  getUserInfo(userId) {
    const userType = this.getUserType(userId);
    const userData = userDatabase.users[userId];
    const hasScheduledKick = this.warnedUsers.has(`${userId}_kick_scheduled`);
    
    return {
      userId,
      userType,
      isAdmin: this.isAdmin(userId),
      isRegistered: this.isRegisteredUser(userId),
      data: userData || null,
      hasScheduledKick,
      kickTimeLeft: hasScheduledKick ? `${this.KICK_DELAY_MINUTES} minutes` : 'No',
      allowedCommands: this.getAllowedCommands(userType),
      allowedThreads: userType === 'admin' ? 'ALL' : this.USER_ALLOWED_THREADS,
      canSendMessages: true
    };
  }

  /**
   * Get allowed commands
   */
  getAllowedCommands(userType) {
    if (userType === 'admin') {
      return ['/daftar', '/lihat_user', '/hapus_user', '/reset_rate_limit', 
              '/laporan_sekarang', '/debug_ga4', '/report_revenue',
              '/cekvar', '/userid', '/profil', '/cekvar_stats',
              '/start', '/scheduler_status', '/bantuan'];
    } else if (userType === 'registered') {
      return ['/cekvar', '/userid', '/profil', '/cekvar_stats',
              '/start', '/scheduler_status', '/bantuan'];
    } else {
      return []; // Unregistered tidak bisa command apapun
    }
  }
}

module.exports = new StrictAccessControl();
