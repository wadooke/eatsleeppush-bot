// services/scheduler.js - VERSI DIPERBAIKI
const cron = require('node-cron');
const path = require('path');
const fs = require('fs').promises;

class BotScheduler {
  constructor(revenueReporter) {
    this.revenueReporter = revenueReporter;
    this.isRunning = false;
    this.reportsDir = path.join(__dirname, '../reports');
    this.backupDir = path.join(__dirname, '../backups');
    this.tasks = new Map();
  }

  /**
   * Mulai semua scheduler otomatis
   */
  startAllSchedulers() {
    try {
      console.log('⏰ Starting automatic schedulers...');
      
      // ============================================
      // 1. SCHEDULER LAPORAN REVENUE HARIAN
      // ============================================
      // Setiap hari jam 12:00 WIB (05:00 UTC) - Railway menggunakan UTC
      console.log('   🕐 Setting up revenue report: 12:00 WIB daily (05:00 UTC)');
      
      const revenueTask = cron.schedule('0 5 * * *', async () => {
        const waktuWIB = this.getCurrentTimeWIB();
        console.log(`\n⏰ [SCHEDULER ${waktuWIB}] Triggering daily revenue report...`);
        await this.executeRevenueReport();
      }, {
        timezone: 'UTC',
        scheduled: true
      });
      
      this.tasks.set('revenue-daily', revenueTask);
      
      // ============================================
      // 2. SCHEDULER BACKUP DATABASE
      // ============================================
      // Setiap hari jam 10:00 WIB (03:00 UTC)
      console.log('   💾 Setting up database backup: 10:00 WIB daily (03:00 UTC)');
      
      const backupTask = cron.schedule('0 3 * * *', async () => {
        const waktuWIB = this.getCurrentTimeWIB();
        console.log(`\n⏰ [SCHEDULER ${waktuWIB}] Triggering database backup...`);
        await this.executeDatabaseBackup();
      }, {
        timezone: 'UTC',
        scheduled: true
      });
      
      this.tasks.set('daily-backup', backupTask);
      
      // ============================================
      // 3. SCHEDULER CLEANUP FILE LAMA
      // ============================================
      // Setiap hari jam 01:00 WIB (18:00 UTC sebelumnya)
      console.log('   🗑️  Setting up file cleanup: 01:00 WIB daily (18:00 UTC)');
      
      const cleanupTask = cron.schedule('0 18 * * *', async () => {
        const waktuWIB = this.getCurrentTimeWIB();
        console.log(`\n⏰ [SCHEDULER ${waktuWIB}] Triggering file cleanup...`);
        await this.cleanupOldFiles();
      }, {
        timezone: 'UTC',
        scheduled: true
      });
      
      this.tasks.set('file-cleanup', cleanupTask);
      
      // ============================================
      // 4. TEST SCHEDULE (Hanya untuk development)
      // ============================================
      if (process.env.NODE_ENV === 'development' || process.env.ENABLE_TEST_SCHEDULE === 'true') {
        console.log('   🧪 Adding test schedule: every 30 minutes');
        
        const testTask = cron.schedule('*/30 * * * *', async () => {
          const waktuWIB = this.getCurrentTimeWIB();
          console.log(`🧪 [TEST ${waktuWIB}] Test schedule is running...`);
          
          // Kirim test ping ke admin
          try {
            if (this.revenueReporter?.bot && process.env.ADMIN_CHAT_ID) {
              await this.revenueReporter.bot.sendMessage(
                process.env.ADMIN_CHAT_ID,
                `🧪 <b>Test Ping dari Scheduler</b>\n\n` +
                `🕐 Waktu: ${waktuWIB} WIB\n` +
                `⚙️ Status: Scheduler berjalan normal\n` +
                `📊 Task Aktif: ${this.tasks.size}`,
                { parse_mode: 'HTML' }
              );
            }
          } catch (error) {
            console.error('   ⚠️  Test ping failed:', error.message);
          }
        }, {
          timezone: 'UTC',
          scheduled: true
        });
        
        this.tasks.set('test-schedule', testTask);
      }
      
      this.isRunning = true;
      
      console.log('✅ Schedulers started successfully!');
      console.log(`   Total tasks: ${this.tasks.size}`);
      
      // Log waktu eksekusi berikutnya
      this.logNextScheduleTimes();
      
      // Kirim notifikasi startup ke admin
      this.sendStartupNotification();
      
    } catch (error) {
      console.error('❌ Failed to start schedulers:', error.message);
      console.error('   Make sure node-cron is installed: npm install node-cron');
      throw error;
    }
  }

  /**
   * Eksekusi laporan revenue harian
   */
  async executeRevenueReport() {
    try {
      if (!this.revenueReporter) {
        throw new Error('Revenue reporter not initialized');
      }
      
      if (typeof this.revenueReporter.sendDailyReport !== 'function') {
        throw new Error('sendDailyReport method not available');
      }
      
      console.log(`   📊 Generating daily revenue report...`);
      
      await this.revenueReporter.sendDailyReport();
      
      console.log(`   ✅ Revenue report completed at ${this.getCurrentTimeWIB()}`);
      
    } catch (error) {
      console.error(`   ❌ Revenue report failed:`, error.message);
      
      // Coba kirim notifikasi error ke admin
      try {
        if (this.revenueReporter?.bot && process.env.ADMIN_CHAT_ID) {
          await this.revenueReporter.bot.sendMessage(
            process.env.ADMIN_CHAT_ID,
            `❌ <b>Laporan Revenue Gagal</b>\n\n` +
            `<code>${error.message}</code>\n\n` +
            `<i>Waktu: ${this.getCurrentTimeWIB()} WIB</i>`,
            { parse_mode: 'HTML' }
          );
        }
      } catch (botError) {
        console.error('   ⚠️  Failed to send error notification:', botError.message);
      }
    }
  }

  /**
   * Eksekusi backup database
   */
  async executeDatabaseBackup() {
    try {
      const waktuWIB = this.getCurrentTimeWIB();
      console.log(`   💾 Creating database backup...`);
      
      // Pastikan folder backup ada
      await fs.mkdir(this.backupDir, { recursive: true });
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = path.join(this.backupDir, `backup-${timestamp}.json`);
      
      // Baca file database
      const dbPath = path.join(__dirname, '../data/user-database.js');
      
      try {
        const dbContent = await fs.readFile(dbPath, 'utf8');
        
        // Ekstrak data user dari file database
        const usersMatch = dbContent.match(/const users = ({[\s\S]*?});/);
        if (usersMatch) {
          const usersData = usersMatch[1];
          
          // Validasi JSON sebelum menyimpan
          let parsedUsers;
          try {
            parsedUsers = JSON.parse(usersData);
          } catch (parseError) {
            // Jika tidak valid JSON, evaluasi sebagai JavaScript object
            parsedUsers = eval(`(${usersData})`);
          }
          
          const backupData = {
            timestamp: new Date().toISOString(),
            dataType: 'user-database',
            users: parsedUsers,
            totalUsers: Object.keys(parsedUsers).length
          };
          
          await fs.writeFile(
            backupFile, 
            JSON.stringify(backupData, null, 2),
            'utf8'
          );
          
          console.log(`   ✅ Database backup created: ${path.basename(backupFile)}`);
          console.log(`   📁 Location: ${backupFile}`);
          
          // Kirim notifikasi ke admin
          try {
            if (this.revenueReporter?.bot && process.env.ADMIN_CHAT_ID) {
              await this.revenueReporter.bot.sendMessage(
                process.env.ADMIN_CHAT_ID,
                `💾 <b>Database Backup Berhasil</b>\n\n` +
                `📁 File: backup-${timestamp}.json\n` +
                `👥 Users: ${backupData.totalUsers}\n` +
                `🕐 Waktu: ${waktuWIB} WIB\n\n` +
                `<i>Backup otomatis setiap hari jam 10:00 WIB</i>`,
                { parse_mode: 'HTML' }
              );
            }
          } catch (notifError) {
            console.error('   ⚠️  Failed to send backup notification:', notifError.message);
          }
          
        } else {
          console.log(`   ⚠️  Could not extract users data from database file`);
        }
        
      } catch (readError) {
        console.error(`   ❌ Failed to read database:`, readError.message);
      }
      
    } catch (error) {
      console.error(`   ❌ Database backup failed:`, error.message);
    }
  }

  /**
   * Bersihkan file lama
   */
  async cleanupOldFiles() {
    try {
      const waktuWIB = this.getCurrentTimeWIB();
      console.log(`   🗑️  Cleaning up old files...`);
      
      // Hapus file laporan lama (> 7 hari)
      const reportsDeleted = await this.cleanupDirectory(this.reportsDir, '.html', 7);
      
      // Hapus file backup lama (> 30 hari)
      const jsonBackupsDeleted = await this.cleanupDirectory(this.backupDir, '.json', 30);
      const jsBackupsDeleted = await this.cleanupDirectory(this.backupDir, '.js', 30);
      
      const totalDeleted = reportsDeleted + jsonBackupsDeleted + jsBackupsDeleted;
      
      console.log(`   ✅ File cleanup completed: ${totalDeleted} files deleted`);
      
      if (totalDeleted > 0) {
        // Kirim notifikasi ke admin
        try {
          if (this.revenueReporter?.bot && process.env.ADMIN_CHAT_ID) {
            await this.revenueReporter.bot.sendMessage(
              process.env.ADMIN_CHAT_ID,
              `🗑️  <b>File Cleanup Selesai</b>\n\n` +
              `📊 Total file dihapus: ${totalDeleted}\n` +
              `📁 Laporan: ${reportsDeleted} file\n` +
              `💾 Backup: ${jsonBackupsDeleted + jsBackupsDeleted} file\n` +
              `🕐 Waktu: ${waktuWIB} WIB\n\n` +
              `<i>Cleanup otomatis setiap hari jam 01:00 WIB</i>`,
              { parse_mode: 'HTML' }
            );
          }
        } catch (notifError) {
          console.error('   ⚠️  Failed to send cleanup notification:', notifError.message);
        }
      }
      
    } catch (error) {
      console.error(`   ❌ File cleanup failed:`, error.message);
    }
  }

  /**
   * Helper: Bersihkan file lama di direktori
   */
  async cleanupDirectory(directory, extension, daysToKeep) {
    try {
      // Pastikan direktori ada
      await fs.access(directory).catch(() => fs.mkdir(directory, { recursive: true }));
      
      const files = await fs.readdir(directory);
      const now = Date.now();
      const msPerDay = 24 * 60 * 60 * 1000;
      let deletedCount = 0;
      
      for (const file of files) {
        if (file.endsWith(extension)) {
          const filePath = path.join(directory, file);
          const stats = await fs.stat(filePath);
          const fileAge = now - stats.mtime.getTime();
          
          if (fileAge > daysToKeep * msPerDay) {
            await fs.unlink(filePath);
            deletedCount++;
          }
        }
      }
      
      return deletedCount;
      
    } catch (error) {
      console.error(`   ⚠️  Failed to cleanup ${directory}:`, error.message);
      return 0;
    }
  }

  /**
   * Log waktu eksekusi berikutnya
   */
  logNextScheduleTimes() {
    console.log('\n📅 Next scheduled executions:');
    
    const now = new Date();
    
    // Waktu dalam UTC untuk Railway
    const schedules = [
      { name: 'Revenue Report', hour: 5, minute: 0, type: 'revenue-daily' },      // 12:00 WIB
      { name: 'Database Backup', hour: 3, minute: 0, type: 'daily-backup' },     // 10:00 WIB
      { name: 'File Cleanup', hour: 18, minute: 0, type: 'file-cleanup' }        // 01:00 WIB
    ];
    
    schedules.forEach(schedule => {
      const nextTime = new Date(now);
      nextTime.setUTCHours(schedule.hour, schedule.minute, 0, 0);
      
      if (nextTime < now) {
        nextTime.setDate(nextTime.getDate() + 1);
      }
      
      const wibTime = new Date(nextTime.getTime() + (7 * 60 * 60 * 1000)); // UTC+7
      const timeStr = wibTime.toLocaleTimeString('id-ID', { 
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      });
      
      const dateStr = wibTime.toLocaleDateString('id-ID', {
        weekday: 'short',
        day: '2-digit',
        month: 'short'
      });
      
      console.log(`   • ${schedule.name}: ${timeStr} WIB (${dateStr})`);
    });
    
    // Tampilkan status tasks
    console.log(`\n⚙️  Scheduler Status:`);
    console.log(`   • Running: ${this.isRunning ? '✅' : '❌'}`);
    console.log(`   • Active Tasks: ${this.tasks.size}`);
    this.tasks.forEach((task, name) => {
      console.log(`   • ${name}: ${task.getStatus()}`);
    });
  }

  /**
   * Kirim notifikasi startup ke admin
   */
  async sendStartupNotification() {
    try {
      if (this.revenueReporter?.bot && process.env.ADMIN_CHAT_ID) {
        const status = this.getStatus();
        const waktuWIB = this.getCurrentTimeWIB();
        
        await this.revenueReporter.bot.sendMessage(
          process.env.ADMIN_CHAT_ID,
          `⏰ <b>Scheduler System Started</b>\n\n` +
          `✅ <b>Status:</b> BERJALAN\n` +
          `📊 <b>Tasks Aktif:</b> ${status.activeTaskCount}\n` +
          `🕐 <b>Waktu:</b> ${waktuWIB} WIB\n\n` +
          `<b>Jadwal Berikutnya:</b>\n` +
          `• Revenue Report: 12:00 WIB\n` +
          `• Database Backup: 10:00 WIB\n` +
          `• File Cleanup: 01:00 WIB\n\n` +
          `<i>Gunakan /scheduler_status untuk cek status</i>`,
          { parse_mode: 'HTML' }
        );
      }
    } catch (error) {
      console.error('⚠️  Failed to send startup notification:', error.message);
    }
  }

  /**
   * Dapatkan waktu sekarang dalam format WIB
   */
  getCurrentTimeWIB() {
    return new Date().toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).replace(/\./g, ':');
  }

  /**
   * Hentikan semua scheduler
   */
  stopAllSchedulers() {
    console.log('\n⏰ Stopping all schedulers...');
    
    try {
      this.tasks.forEach((task, name) => {
        if (task && typeof task.stop === 'function') {
          task.stop();
          console.log(`   ✅ Stopped task: ${name}`);
        }
      });
      
      this.tasks.clear();
      this.isRunning = false;
      
      console.log('✅ All schedulers stopped');
      
    } catch (error) {
      console.error('❌ Error stopping schedulers:', error.message);
    }
  }

  /**
   * Dapatkan status scheduler
   */
  getStatus() {
    const activeTasks = Array.from(this.tasks.keys());
    
    // Hitung waktu berikutnya
    const now = new Date();
    const nextRevenue = this.calculateNextTime(5, 0);    // 12:00 WIB
    const nextBackup = this.calculateNextTime(3, 0);     // 10:00 WIB
    const nextCleanup = this.calculateNextTime(18, 0);   // 01:00 WIB
    
    return {
      isRunning: this.isRunning,
      activeTasks: activeTasks,
      activeTaskCount: activeTasks.length,
      nextRevenueReport: nextRevenue,
      nextBackup: nextBackup,
      nextCleanup: nextCleanup
    };
  }

  /**
   * Hitung waktu berikutnya untuk jadwal
   */
  calculateNextTime(utcHour, utcMinute) {
    const now = new Date();
    const nextTime = new Date(now);
    
    nextTime.setUTCHours(utcHour, utcMinute, 0, 0);
    
    if (nextTime < now) {
      nextTime.setDate(nextTime.getDate() + 1);
    }
    
    // Konversi ke WIB (UTC+7)
    const wibTime = new Date(nextTime.getTime() + (7 * 60 * 60 * 1000));
    
    return {
      utc: nextTime.toISOString(),
      wib: wibTime.toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      timeOnly: wibTime.toLocaleTimeString('id-ID', {
        timeZone: 'Asia/Jakarta',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      })
    };
  }
}

module.exports = BotScheduler;
