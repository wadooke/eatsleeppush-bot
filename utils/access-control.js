// utils/access-control.js - Access control & rate limiting
class AccessControl {
  constructor() {
    this.allowedThreads = new Set(); // Thread yang boleh diakses user
    this.botOnlyThreads = new Set(); // Thread khusus bot
    this.userCooldowns = new Map(); // userId -> lastRequestTime
    this.userHourlyRequests = new Map(); // userId -> {count, resetTime}
    
    this.loadConfig();
  }

  loadConfig() {
    // Thread yang diizinkan untuk user (bisa kirim pesan)
    const userThreads = [
      parseInt(process.env.DISKUSI_UMUM_THREAD_ID || 1),
      parseInt(process.env.APLIKASI_THREAD_ID || 7),
      parseInt(process.env.TUTORIAL_THREAD_ID || 5)
    ];

    // Thread khusus bot (user tidak boleh kirim pesan)
    const botThreads = [
      parseInt(process.env.LAPORAN_THREAD_ID || 3),
      parseInt(process.env.PENGUMUMAN_THREAD_ID || 9)
    ];

    this.allowedThreads = new Set(userThreads);
    this.botOnlyThreads = new Set(botThreads);

    console.log('🔒 Access Control Configuration:');
    console.log(`   User allowed threads: ${[...this.allowedThreads].join(', ')}`);
    console.log(`   Bot-only threads: ${[...this.botOnlyThreads].join(', ')}`);
  }

  /**
   * Cek apakah user boleh kirim pesan di thread tertentu
   */
  canUserSendInThread(threadId, isBot = false) {
    const thread = parseInt(threadId);
    
    // Bot bisa kirim di semua thread
    if (isBot) return true;
    
    // User tidak boleh kirim di thread khusus bot
    if (this.botOnlyThreads.has(thread)) {
      return false;
    }
    
    // User hanya boleh kirim di thread yang diizinkan
    return this.allowedThreads.has(thread);
  }

  /**
   * Cek apakah command harus dialihkan ke thread lain
   * Misal: /cekvar harus selalu ke thread LAPORAN
   */
  getRedirectThreadForCommand(command, currentThreadId) {
    const currentThread = parseInt(currentThreadId || 0);
    
    // /cekvar harus selalu di thread LAPORAN
    if (command === '/cekvar') {
      const laporanThread = parseInt(process.env.LAPORAN_THREAD_ID || 3);
      return currentThread === laporanThread ? null : laporanThread;
    }
    
    return null; // Tidak perlu redirect
  }

  /**
   * Rate limiting untuk /cekvar
   */
  checkRateLimit(userId) {
    const userIdStr = userId.toString();
    const cooldownMinutes = parseInt(process.env.CEKVAR_COOLDOWN_MINUTES || 30);
    const maxPerHour = parseInt(process.env.MAX_REQUESTS_PER_HOUR || 10);
    const now = Date.now();
    
    // 1. Cek cooldown (30 menit)
    const lastRequest = this.userCooldowns.get(userIdStr);
    if (lastRequest) {
      const minutesSinceLast = (now - lastRequest) / (1000 * 60);
      if (minutesSinceLast < cooldownMinutes) {
        const remainingMinutes = Math.ceil(cooldownMinutes - minutesSinceLast);
        return {
          allowed: false,
          reason: `cooldown`,
          waitMinutes: remainingMinutes,
          message: `⏳ Tunggu ${remainingMinutes} menit lagi sebelum menggunakan /cekvar`
        };
      }
    }
    
    // 2. Cek hourly limit (10 request per jam)
    let userStats = this.userHourlyRequests.get(userIdStr);
    if (!userStats || now >= userStats.resetTime) {
      userStats = {
        count: 0,
        resetTime: now + (60 * 60 * 1000) // Reset dalam 1 jam
      };
      this.userHourlyRequests.set(userIdStr, userStats);
    }
    
    if (userStats.count >= maxPerHour) {
      const resetTime = new Date(userStats.resetTime);
      const remainingMinutes = Math.ceil((userStats.resetTime - now) / (1000 * 60));
      return {
        allowed: false,
        reason: `hourly_limit`,
        remainingMinutes: remainingMinutes,
        message: `🚫 Anda sudah menggunakan /cekvar ${maxPerHour} kali dalam 1 jam. Tunggu ${remainingMinutes} menit lagi.`
      };
    }
    
    // Update counters
    this.userCooldowns.set(userIdStr, now);
    userStats.count++;
    
    return {
      allowed: true,
      cooldown: cooldownMinutes,
      requestsLeft: maxPerHour - userStats.count,
      resetIn: Math.ceil((userStats.resetTime - now) / (1000 * 60))
    };
  }

  /**
   * Reset rate limit untuk user tertentu (untuk admin)
   */
  resetRateLimit(userId) {
    const userIdStr = userId.toString();
    this.userCooldowns.delete(userIdStr);
    this.userHourlyRequests.delete(userIdStr);
    return true;
  }

  /**
   * Get user rate limit stats (untuk debug/admin)
   */
  getUserStats(userId) {
    const userIdStr = userId.toString();
    const lastRequest = this.userCooldowns.get(userIdStr);
    const hourlyStats = this.userHourlyRequests.get(userIdStr);
    
    return {
      userId: userIdStr,
      lastRequestTime: lastRequest ? new Date(lastRequest).toLocaleString('id-ID') : 'Never',
      hourlyCount: hourlyStats?.count || 0,
      hourlyReset: hourlyStats ? new Date(hourlyStats.resetTime).toLocaleString('id-ID') : 'N/A',
      cooldownMinutes: parseInt(process.env.CEKVAR_COOLDOWN_MINUTES || 30),
      maxPerHour: parseInt(process.env.MAX_REQUESTS_PER_HOUR || 10)
    };
  }
}

// Export singleton instance
module.exports = new AccessControl();
