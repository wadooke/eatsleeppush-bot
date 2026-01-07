// commands/admin-commands.js - FINAL VERSION dengan Strict User Management
const accessControl = require('../utils/access-control');
const userDatabase = require('../data/user-database');

class AdminCommands {
  constructor() {
    console.log('👑 Admin Commands initialized');
  }

  /**
   * Handle /daftar command - Register new user
   */
  async handleDaftar(bot, msg, args) {
    const adminId = msg.from.id.toString();
    const threadId = msg.message_thread_id || 0;
    const chatId = msg.chat.id;
    
    // Cek apakah admin
    if (!accessControl.isAdmin(adminId)) {
      return bot.sendMessage(chatId,
        '❌ <b>Access Denied</b>\n\n' +
        'Hanya admin yang bisa menggunakan command ini.',
        {
          parse_mode: 'HTML',
          ...(threadId && { message_thread_id: threadId })
        }
      );
    }
    
    // Parse arguments
    let targetUserId, targetUsername;
    
    if (typeof args === 'string') {
      // Jika args adalah string langsung
      if (args.startsWith('@')) {
        targetUsername = args;
        targetUserId = args.substring(1); // Remove @
      } else if (/^\d+$/.test(args)) {
        targetUserId = args;
        targetUsername = `user_${args}`;
      } else {
        targetUsername = args;
        targetUserId = args; // Use as ID jika bukan numeric
      }
    } else if (args && args[1]) {
      // Jika args dari regex match
      const input = args[1].trim();
      if (input.startsWith('@')) {
        targetUsername = input;
        targetUserId = input.substring(1);
      } else if (/^\d+$/.test(input)) {
        targetUserId = input;
        targetUsername = `user_${input}`;
      } else {
        targetUsername = input;
        targetUserId = input;
      }
    } else {
      return bot.sendMessage(chatId,
        '❌ <b>Format Salah</b>\n\n' +
        'Gunakan: <code>/daftar @username</code> atau <code>/daftar USER_ID</code>\n\n' +
        'Contoh:\n' +
        '• <code>/daftar @johndoe</code>\n' +
        '• <code>/daftar 123456789</code>',
        {
          parse_mode: 'HTML',
          ...(threadId && { message_thread_id: threadId })
        }
      );
    }
    
    try {
      // Register user
      const result = accessControl.registerUser(adminId, targetUserId, targetUsername);
      
      if (result.success) {
        await bot.sendMessage(chatId,
          `✅ <b>User Berhasil Didaftarkan</b>\n\n` +
          `<b>Username:</b> ${targetUsername}\n` +
          `<b>User ID:</b> <code>${targetUserId}</code>\n` +
          `<b>Waktu:</b> ${new Date().toLocaleString('id-ID')}\n` +
          `<b>Oleh Admin:</b> ${msg.from.first_name || 'Admin'}\n\n` +
          `<i>${result.message}</i>`,
          {
            parse_mode: 'HTML',
            ...(threadId && { message_thread_id: threadId })
          }
        );
        
        // Notify the registered user if possible
        try {
          await bot.sendMessage(targetUserId,
            `🎉 <b>Selamat! Anda Telah Terdaftar</b>\n\n` +
            `Anda telah didaftarkan oleh admin <b>${msg.from.first_name || 'Admin'}</b>.\n\n` +
            `✅ <b>Sekarang Anda bisa:</b>\n` +
            `• Gunakan <code>/cekvar</code> di Thread 1\n` +
            `• Gunakan <code>/userid</code> di Thread 1\n` +
            `• Kirim pesan/gambar di Thread 1, 7, 5\n\n` +
            `❌ <b>Tidak bisa:</b>\n` +
            `• Gunakan command admin\n` +
            `• Akses thread khusus bot\n\n` +
            `<i>Terima kasih telah bergabung!</i>`,
            { parse_mode: 'HTML' }
          );
        } catch (notifyError) {
          console.log(`ℹ️  Could not notify user ${targetUserId}: ${notifyError.message}`);
        }
        
      } else {
        await bot.sendMessage(chatId,
          `❌ <b>Gagal Mendaftarkan User</b>\n\n` +
          `<code>${result.message}</code>\n\n` +
          `<i>Pastikan user ID valid dan belum terdaftar.</i>`,
          {
            parse_mode: 'HTML',
            ...(threadId && { message_thread_id: threadId })
          }
        );
      }
      
    } catch (error) {
      console.error('❌ Error in handleDaftar:', error);
      await bot.sendMessage(chatId,
        `❌ <b>Terjadi Kesalahan Sistem</b>\n\n` +
        `<code>${error.message}</code>`,
        {
          parse_mode: 'HTML',
          ...(threadId && { message_thread_id: threadId })
        }
      );
    }
  }

  /**
   * Handle /lihat_user command - View all registered users
   */
  async handleLihatUser(bot, msg) {
    const adminId = msg.from.id.toString();
    const threadId = msg.message_thread_id || 0;
    const chatId = msg.chat.id;
    
    // Cek apakah admin
    if (!accessControl.isAdmin(adminId)) {
      return bot.sendMessage(chatId,
        '❌ <b>Access Denied</b>\n\n' +
        'Hanya admin yang bisa menggunakan command ini.',
        {
          parse_mode: 'HTML',
          ...(threadId && { message_thread_id: threadId })
        }
      );
    }
    
    try {
      const users = userDatabase.users;
      const userCount = Object.keys(users).length;
      
      if (userCount === 0) {
        return bot.sendMessage(chatId,
          '📋 <b>Daftar User Terdaftar</b>\n\n' +
          '❌ <i>Belum ada user yang terdaftar.</i>',
          {
            parse_mode: 'HTML',
            ...(threadId && { message_thread_id: threadId })
          }
        );
      }
      
      // Format user list
      let userList = '';
      let counter = 1;
      
      for (const [userId, userData] of Object.entries(users)) {
        const regDate = new Date(userData.registeredAt).toLocaleDateString('id-ID');
        userList += `${counter}. <b>${userData.username}</b>\n` +
                   `   ID: <code>${userId}</code>\n` +
                   `   Tanggal: ${regDate}\n` +
                   `   Oleh: ${userData.registeredBy || 'System'}\n\n`;
        counter++;
        
        // Limit untuk mencegah message terlalu panjang
        if (counter > 20) {
          userList += `... dan ${userCount - 20} user lainnya`;
          break;
        }
      }
      
      await bot.sendMessage(chatId,
        `📋 <b>Daftar User Terdaftar</b>\n\n` +
        `<b>Total User:</b> ${userCount}\n\n` +
        `${userList}\n` +
        `<i>Gunakan /hapus_user USER_ID untuk menghapus user.</i>`,
        {
          parse_mode: 'HTML',
          ...(threadId && { message_thread_id: threadId })
        }
      );
      
    } catch (error) {
      console.error('❌ Error in handleLihatUser:', error);
      await bot.sendMessage(chatId,
        `❌ <b>Terjadi Kesalahan</b>\n\n` +
        `<code>${error.message}</code>`,
        {
          parse_mode: 'HTML',
          ...(threadId && { message_thread_id: threadId })
        }
      );
    }
  }

  /**
   * Handle /hapus_user command - Remove registered user
   */
  async handleHapusUser(bot, msg, args) {
    const adminId = msg.from.id.toString();
    const threadId = msg.message_thread_id || 0;
    const chatId = msg.chat.id;
    
    // Cek apakah admin
    if (!accessControl.isAdmin(adminId)) {
      return bot.sendMessage(chatId,
        '❌ <b>Access Denied</b>\n\n' +
        'Hanya admin yang bisa menggunakan command ini.',
        {
          parse_mode: 'HTML',
          ...(threadId && { message_thread_id: threadId })
        }
      );
    }
    
    // Parse user ID to remove
    let targetUserId;
    
    if (typeof args === 'string') {
      targetUserId = args.trim();
    } else if (args && args[1]) {
      targetUserId = args[1].trim();
    } else {
      return bot.sendMessage(chatId,
        '❌ <b>Format Salah</b>\n\n' +
        'Gunakan: <code>/hapus_user USER_ID</code>\n\n' +
        'Contoh:\n' +
        '• <code>/hapus_user 123456789</code>\n\n' +
        '<i>Gunakan /lihat_user untuk melihat daftar user.</i>',
        {
          parse_mode: 'HTML',
          ...(threadId && { message_thread_id: threadId })
        }
      );
    }
    
    try {
      // Remove user
      const result = accessControl.removeUser(adminId, targetUserId);
      
      if (result.success) {
        await bot.sendMessage(chatId,
          `🗑️ <b>User Berhasil Dihapus</b>\n\n` +
          `<b>User ID:</b> <code>${targetUserId}</code>\n` +
          `<b>Waktu:</b> ${new Date().toLocaleString('id-ID')}\n` +
          `<b>Oleh Admin:</b> ${msg.from.first_name || 'Admin'}\n\n` +
          `<i>User tidak lagi bisa mengakses sistem.</i>`,
          {
            parse_mode: 'HTML',
            ...(threadId && { message_thread_id: threadId })
          }
        );
      } else {
        await bot.sendMessage(chatId,
          `❌ <b>Gagal Menghapus User</b>\n\n` +
          `<code>${result.message}</code>\n\n` +
          `<i>Pastikan user ID valid dan terdaftar.</i>`,
          {
            parse_mode: 'HTML',
            ...(threadId && { message_thread_id: threadId })
          }
        );
      }
      
    } catch (error) {
      console.error('❌ Error in handleHapusUser:', error);
      await bot.sendMessage(chatId,
        `❌ <b>Terjadi Kesalahan Sistem</b>\n\n` +
        `<code>${error.message}</code>`,
        {
          parse_mode: 'HTML',
          ...(threadId && { message_thread_id: threadId })
        }
      );
    }
  }

  /**
   * Handle /reset_rate_limit command - Reset user's rate limit
   */
  async handleResetRateLimit(bot, msg, args) {
    const adminId = msg.from.id.toString();
    const threadId = msg.message_thread_id || 0;
    const chatId = msg.chat.id;
    
    // Cek apakah admin
    if (!accessControl.isAdmin(adminId)) {
      return bot.sendMessage(chatId,
        '❌ <b>Access Denied</b>\n\n' +
        'Hanya admin yang bisa menggunakan command ini.',
        {
          parse_mode: 'HTML',
          ...(threadId && { message_thread_id: threadId })
        }
      );
    }
    
    // Parse user ID
    let targetUserId;
    
    if (typeof args === 'string') {
      targetUserId = args.trim();
    } else if (args && args[1]) {
      targetUserId = args[1].trim();
    } else {
      return bot.sendMessage(chatId,
        '❌ <b>Format Salah</b>\n\n' +
        'Gunakan: <code>/reset_rate_limit USER_ID</code>\n\n' +
        'Contoh:\n' +
        '• <code>/reset_rate_limit 123456789</code>',
        {
          parse_mode: 'HTML',
          ...(threadId && { message_thread_id: threadId })
        }
      );
    }
    
    try {
      // Reset rate limit logic here
      // (Implementasi tergantung sistem rate limit Anda)
      
      await bot.sendMessage(chatId,
        `🔄 <b>Rate Limit Berhasil Direset</b>\n\n` +
        `<b>User ID:</b> <code>${targetUserId}</code>\n` +
        `<b>Waktu:</b> ${new Date().toLocaleString('id-ID')}\n` +
        `<b>Oleh Admin:</b> ${msg.from.first_name || 'Admin'}\n\n` +
        `<i>User sekarang bisa menggunakan command kembali.</i>`,
        {
          parse_mode: 'HTML',
          ...(threadId && { message_thread_id: threadId })
        }
      );
      
    } catch (error) {
      console.error('❌ Error in handleResetRateLimit:', error);
      await bot.sendMessage(chatId,
        `❌ <b>Terjadi Kesalahan</b>\n\n` +
        `<code>${error.message}</code>`,
        {
          parse_mode: 'HTML',
          ...(threadId && { message_thread_id: threadId })
        }
      );
    }
  }

  /**
   * Handle new chat members
   */
  async handleNewChatMembers(bot, msg) {
    try {
      const newMembers = msg.new_chat_members;
      const chatId = msg.chat.id;
      
      if (!newMembers || newMembers.length === 0) return;
      
      for (const member of newMembers) {
        // Skip jika member adalah bot
        if (member.is_bot) continue;
        
        const userId = member.id.toString();
        const userName = member.first_name || 'New User';
        
        console.log(`👋 New member: ${userName} (${userId}) joined the group`);
        
        // Check if user is already registered
        if (accessControl.isRegisteredUser(userId) || accessControl.isAdmin(userId)) {
          // User sudah terdaftar atau admin
          await bot.sendMessage(chatId,
            `👋 <b>Selamat Datang Kembali!</b>\n\n` +
            `<b>${userName}</b> sudah terdaftar di sistem.\n\n` +
            `✅ Anda bisa langsung menggunakan command sesuai aturan.`,
            { parse_mode: 'HTML' }
          );
        } else {
          // User belum terdaftar - kirim warning
          await bot.sendMessage(chatId,
            `⚠️ <b>PERINGATAN untuk User Baru</b>\n\n` +
            `Selamat datang <b>${userName}</b>!\n\n` +
            `❌ <b>Anda BELUM TERDAFTAR</b>\n` +
            `• Tidak bisa kirim pesan/command\n` +
            `• Akan di-kick dalam 30 menit\n\n` +
            `✅ <b>Langkah mendaftar:</b>\n` +
            `1. Hubungi Admin ID: <code>${process.env.ADMIN_CHAT_ID || '8462501080'}</code>\n` +
            `2. Minta didaftarkan\n` +
            `3. Tunggu konfirmasi\n\n` +
            `<i>ID Anda: <code>${userId}</code></i>`,
            { parse_mode: 'HTML' }
          );
        }
      }
      
    } catch (error) {
      console.error('❌ Error in handleNewChatMembers:', error.message);
    }
  }

  /**
   * Get admin commands list
   */
  getAdminCommands() {
    return {
      '👑 Admin Commands': {
        '/daftar [@username|USER_ID]': 'Daftarkan user baru',
        '/lihat_user': 'Lihat semua user terdaftar',
        '/hapus_user USER_ID': 'Hapus user terdaftar',
        '/reset_rate_limit USER_ID': 'Reset rate limit user',
        '/laporan_sekarang': 'Generate laporan manual',
        '/debug_ga4': 'Debug GA4 connection',
        '/report_revenue': 'Generate revenue report'
      },
      '📋 User Commands': {
        '/cekvar': 'Cek data GA4 (Thread 1 only)',
        '/userid': 'Lihat user ID (Thread 1 only)',
        '/profil': 'Lihat profil user',
        '/cekvar_stats': 'Statistik penggunaan',
        '/bantuan': 'Panduan penggunaan',
        '/start': 'Menu utama',
        '/scheduler_status': 'Status scheduler'
      }
    };
  }
}

module.exports = new AdminCommands();
