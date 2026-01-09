// data/user-database.js - FINAL VERSION dengan Auto-Save & Backup
const fs = require('fs').promises;
const path = require('path');

class UserDatabase {
  constructor() {
    this.dbPath = path.join(__dirname, 'users.json');
    this.backupDir = path.join(__dirname, '../backups');
    this.users = {};
    this.isLoaded = false;
    
    console.log('📦 UserDatabase instance created');
    
    // Auto-save interval (5 minutes)
    this.autoSaveInterval = 0; // 0 = disabled
    // this.autoSaveInterval = 5 * 60 * 1000;
    this.saveTimer = null;
    
    // Load database saat startup
    this.loadFromFile();
    
    // Start auto-save
    // this.startAutoSave();
    console.log('⏰ Auto-save DISABLED (temporary)');
  }

  /**
   * Load users from JSON file
   */
  async loadFromFile() {
    try {
      console.log(`📂 Loading user database from: ${this.dbPath}`);
      
      const data = await fs.readFile(this.dbPath, 'utf8');
      this.users = JSON.parse(data);
      this.isLoaded = true;
      
      console.log(`✅ Loaded ${Object.keys(this.users).length} registered users from file`);
      console.log(`   Users: [ ${Object.keys(this.users).join(', ')} ]`);
      
      // Create backup of loaded data
      await this.createBackup();
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, create new
        console.log('ℹ️  No user database file found, creating new database');
        this.users = {};
        await this.saveToFile(); // Create empty file
      } else {
        console.error('❌ Failed to load user database:', error.message);
        this.users = {};
      }
      this.isLoaded = true;
    }
  }

  /**
   * Save users to JSON file
   */
  async saveToFile() {
    try {
      if (!this.isLoaded) {
        console.log('⏳ Database not loaded yet, skipping save');
        return;
      }
      
      // Ensure directory exists
      const dir = path.dirname(this.dbPath);
      await fs.mkdir(dir, { recursive: true }).catch(() => {});
      
      // Save to file
      await fs.writeFile(this.dbPath, JSON.stringify(this.users, null, 2), 'utf8');
      
      console.log(`💾 Saved ${Object.keys(this.users).length} users to database`);
      
    } catch (error) {
      console.error('❌ Failed to save user database:', error.message);
      
      // Try to save to backup location
      await this.emergencySave();
    }
  }

  /**
   * Emergency save to backup location
   */
  async emergencySave() {
    try {
      const backupPath = path.join(this.backupDir, `users-emergency-${Date.now()}.json`);
      await fs.mkdir(this.backupDir, { recursive: true });
      await fs.writeFile(backupPath, JSON.stringify(this.users, null, 2), 'utf8');
      console.log(`⚠️  Emergency save to: ${backupPath}`);
    } catch (error) {
      console.error('❌ Emergency save also failed:', error.message);
    }
  }

  /**
   * Create backup of current database
   */
  async createBackup() {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(this.backupDir, `users-backup-${timestamp}.json`);
      
      await fs.writeFile(backupPath, JSON.stringify(this.users, null, 2), 'utf8');
      
      console.log(`📦 Backup created: ${backupPath}`);
      
      // Cleanup old backups (keep last 7 days)
      await this.cleanupOldBackups();
      
    } catch (error) {
      console.error('❌ Failed to create backup:', error.message);
    }
  }

  /**
   * Cleanup old backup files
   */
  async cleanupOldBackups(daysToKeep = 7) {
    try {
      const files = await fs.readdir(this.backupDir);
      const now = Date.now();
      const msPerDay = 24 * 60 * 60 * 1000;
      
      for (const file of files) {
        if (file.startsWith('users-backup-') && file.endsWith('.json')) {
          const filePath = path.join(this.backupDir, file);
          const stats = await fs.stat(filePath);
          const fileAge = now - stats.mtime.getTime();
          
          if (fileAge > daysToKeep * msPerDay) {
            await fs.unlink(filePath);
            console.log(`🗑️  Old backup deleted: ${file}`);
          }
        }
      }
    } catch (error) {
      console.error('❌ Failed to cleanup old backups:', error.message);
    }
  }

  /**
   * Start auto-save timer
   */
  startAutoSave() {
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
    }
    
    this.saveTimer = setInterval(() => {
      this.saveToFile().catch(() => {});
    }, this.autoSaveInterval);
    
    console.log(`⏰ Auto-save enabled (every ${this.autoSaveInterval / 60000} minutes)`);
  }

  /**
   * Stop auto-save timer
   */
  stopAutoSave() {
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
      this.saveTimer = null;
      console.log('⏰ Auto-save disabled');
    }
  }

  /**
   * Register a new user
   */
  registerUser(userId, userData) {
    if (!userId || !userData) {
      throw new Error('Invalid user data');
    }
    
    // Check if user already exists
    if (this.users[userId]) {
      console.log(`ℹ️  User ${userId} already exists, updating...`);
    }
    
    this.users[userId] = {
      ...userData,
      lastUpdated: new Date().toISOString()
    };
    
    console.log(`✅ User ${userId} registered/updated in database`);
    
    // Auto-save immediately
    this.saveToFile().catch(() => {});
    
    return this.users[userId];
  }

  /**
   * Remove a user
   */
  removeUser(userId) {
    if (!this.users[userId]) {
      console.log(`ℹ️  User ${userId} not found in database`);
      return false;
    }
    
    const username = this.users[userId].username;
    delete this.users[userId];
    
    console.log(`🗑️  User ${userId} (${username}) removed from database`);
    
    // Auto-save immediately
    this.saveToFile().catch(() => {});
    
    return true;
  }

  /**
   * Get user by ID
   */
  getUser(userId) {
    return this.users[userId] || null;
  }

  /**
   * Get all users
   */
  getAllUsers() {
    return { ...this.users };
  }

  /**
   * Get user count
   */
  getUserCount() {
    return Object.keys(this.users).length;
  }

  /**
   * Check if user exists
   */
  userExists(userId) {
    return !!this.users[userId];
  }

  /**
   * Update user data
   */
  updateUser(userId, updates) {
    if (!this.users[userId]) {
      throw new Error(`User ${userId} not found`);
    }
    
    this.users[userId] = {
      ...this.users[userId],
      ...updates,
      lastUpdated: new Date().toISOString()
    };
    
    console.log(`✏️  User ${userId} updated in database`);
    
    // Auto-save immediately
    this.saveToFile().catch(() => {});
    
    return this.users[userId];
  }

  /**
   * Search users by username
   */
  searchUsers(searchTerm) {
    const results = [];
    const term = searchTerm.toLowerCase();
    
    for (const [userId, userData] of Object.entries(this.users)) {
      if (
        userId.includes(term) ||
        (userData.username && userData.username.toLowerCase().includes(term))
      ) {
        results.push({ userId, ...userData });
      }
    }
    
    return results;
  }

  /**
   * Get database statistics
   */
  getStats() {
    const users = Object.values(this.users);
    
    return {
      totalUsers: users.length,
      recentlyRegistered: users.filter(u => {
        const regDate = new Date(u.registeredAt || u.lastUpdated);
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        return regDate > weekAgo;
      }).length,
      byAdmin: users.reduce((acc, user) => {
        const adminId = user.registeredBy;
        acc[adminId] = (acc[adminId] || 0) + 1;
        return acc;
      }, {})
    };
  }

  /**
   * Export database to readable format
   */
  exportToCSV() {
    let csv = 'User ID,Username,Registered At,Registered By,Last Updated\n';
    
    for (const [userId, userData] of Object.entries(this.users)) {
      const row = [
        userId,
        userData.username || '',
        userData.registeredAt || '',
        userData.registeredBy || '',
        userData.lastUpdated || ''
      ].map(field => `"${field}"`).join(',');
      
      csv += row + '\n';
    }
    
    return csv;
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log('🛑 Shutting down UserDatabase...');
    
    // Stop auto-save
    this.stopAutoSave();
    
    // Final save
    await this.saveToFile();
    
    // Create final backup
    await this.createBackup();
    
    console.log('✅ UserDatabase shutdown complete');
  }
}

// Create singleton instance
const userDatabase = new UserDatabase();

// Handle process termination
process.on('SIGINT', async () => {
  await userDatabase.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await userDatabase.shutdown();
  process.exit(0);
});

// Export the instance
module.exports = userDatabase;
