// services/scheduler.js
const cron = require('node-cron');
const path = require('path');
const fs = require('fs').promises;

class BotScheduler {
  constructor(revenueReporter) {
    this.revenueReporter = revenueReporter;
    this.isRunning = false;
    this.reportsDir = path.join(__dirname, '../reports');
    this.backupDir = path.join(__dirname, '../backups');
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
      // Setiap hari jam 12:00 WIB (05:00 UTC)
      cron.schedule('0 5 * * *', async () => {
        await this.executeRevenueReport();
      }, {
        timezone: 'UTC',
        name: 'revenue-daily-report'
      });

      // ============================================
      // 2. SCHEDULER BACKUP DATABASE
      // ============================================
      // Setiap hari jam 10:00 WIB (03:00 UTC)
      cron.schedule('0 3 * * *', async () => {
        await this.executeDatabaseBackup();
      }, {
        timezone: 'UTC',
        name: 'daily-backup'
      });

      // ============================================
      // 3. SCHEDULER CLEANUP FILE LAMA
      // ============================================
      // Setiap hari jam 01:00 WIB (18:00 UTC sebelumnya)
      cron.schedule('0 18 * * *', async () => {
        await this.cleanupOldFiles();
      }, {
        timezone: 'UTC',
        name: 'file-cleanup'
      });

      this.isRunning = true;
      
      console.log('✅ Schedulers started successfully:');
      console.log('   • Laporan Revenue: 12:00 WIB setiap hari');
      console.log('   • Backup Database: 10:00 WIB setiap hari');
      console.log('   • Cleanup Files: 01:00 WIB setiap hari');
      
      // Log waktu berikutnya
      this.logNextScheduleTimes();
      
    } catch (error) {
      console.error('❌ Failed to start schedulers:', error.message);
      console.error('   Make sure node-cron is installed: npm install node-cron');
    }
  }

  /**
   * Eksekusi laporan revenue harian
   */
  async executeRevenueReport() {
    try {
      const waktuWIB = this.getCurrentTimeWIB();
      console.log(`\n⏰ [SCHEDULER ${waktuWIB}] Starting daily revenue report...`);
      
      if (!this.revenueReporter) {
        throw new Error('Revenue reporter not initialized');
      }
      
      if (typeof this.revenueReporter.sendDailyReport !== 'function') {
        throw new Error('sendDailyReport method not available');
      }
      
      console.log(`   📊 Generating revenue report...`);
      
      await this.revenueReporter.sendDailyReport();
      
      console.log(`   ✅ Revenue report completed at ${this.getCurrentTimeWIB()}`);
      
    } catch (error) {
      console.error(`   ❌ Revenue report failed:`, error.message);
      
      // Coba kirim notifikasi error ke admin jika ada
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
      console.log(`\n⏰ [SCHEDULER ${waktuWIB}] Starting database backup...`);
      
      // Pastikan folder backup ada
      await fs.mkdir(this.backupDir, { recursive: true });
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = path.join(this.backupDir, `backup-${timestamp}.json`);
      
      // Baca file database
      const dbPath = path.join(__dirname, '../data/user-database.js');
      let dbContent;
      
      try {
        dbContent = await fs.readFile(dbPath, 'utf8');
        
        // Ekstrak data user dari file database
        const usersMatch = dbContent.match(/const users = ({[\s\S]*?});/);
        if (usersMatch) {
          const usersData = usersMatch[1];
          const backupData = {
            timestamp: new Date().toISOString(),
            dataType: 'user-database',
            users: eval(`(${usersData})`) // Hati-hati, hanya untuk data internal
          };
          
          await fs.writeFile(
            backupFile, 
            JSON.stringify(backupData, null, 2),
            'utf8'
          );
          
          console.log(`   ✅ Database backup created: ${path.basename(backupFile)}`);
          console.log(`   📁 Location: ${backupFile}`);
          
          // Juga backup sebagai .js file untuk kemudahan restore
          const jsBackupFile = path.join(this.backupDir, `backup-${timestamp}.js`);
          await fs.writeFile(
            jsBackupFile,
            `// Backup created: ${new Date().toISOString()}\n` +
            `// Original: user-database.js\n\n` +
            `const backupUsers = ${usersData};\n\n` +
            `module.exports = { users: backupUsers };\n`,
            'utf8'
          );
          
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
      console.log(`\n⏰ [SCHEDULER ${waktuWIB}] Starting file cleanup...`);
      
      // Hapus file laporan lama (> 7 hari)
      await this.cleanupDirectory(this.reportsDir, '.html', 7);
      
      // Hapus file backup lama (> 30 hari)
      await this.cleanupDirectory(this.backupDir, '.json', 30);
      await this.cleanupDirectory(this.backupDir, '.js', 30);
      
      console.log(`   ✅ File cleanup completed`);
      
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
            console.log(`   🗑️  Deleted old file: ${file}`);
          }
        }
      }
      
      if (deletedCount > 0) {
        console.log(`   📊 Cleaned ${deletedCount} old ${extension} files from ${path.basename(directory)}`);
      }
      
    } catch (error) {
      console.error(`   ⚠️  Failed to cleanup ${directory}:`, error.message);
    }
  }

  /**
   * Log waktu eksekusi berikutnya
   */
  logNextScheduleTimes() {
    console.log('\n📅 Next scheduled executions:');
    
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    // Waktu dalam UTC
    const schedules = [
      { name: 'Revenue Report', hour: 5, minute: 0 },  // 12:00 WIB
      { name: 'Database Backup', hour: 3, minute: 0 }, // 10:00 WIB
      { name: 'File Cleanup', hour: 18, minute: 0 }    // 01:00 WIB (hari berikutnya)
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
      
      console.log(`   • ${schedule.name}: ${timeStr} WIB`);
    });
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
      const tasks = cron.getTasks();
      if (tasks && tasks.size > 0) {
        tasks.forEach(task => {
          if (task && typeof task.stop === 'function') {
            task.stop();
          }
        });
        console.log(`   ✅ Stopped ${tasks.size} scheduled tasks`);
      } else {
        console.log(`   ℹ️  No active scheduled tasks found`);
      }
      
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
    const tasks = cron.getTasks();
    const activeTasks = tasks ? Array.from(tasks.keys()) : [];
    
    return {
      isRunning: this.isRunning,
      activeTasks: activeTasks,
      activeTaskCount: activeTasks.length,
      nextRevenueReport: this.calculateNextTime(5, 0),  // 12:00 WIB
      nextBackup: this.calculateNextTime(3, 0),        // 10:00 WIB
      nextCleanup: this.calculateNextTime(18, 0)       // 01:00 WIB
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
      })
    };
  }
}

module.exports = BotScheduler;
