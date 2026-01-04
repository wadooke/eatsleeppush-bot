// data/user-database.js - COMPLETE VERSION
const fs = require('fs').promises;
const path = require('path');

const DB_PATH = path.join(__dirname, 'user-database.json');

class UserDatabase {
  constructor() {
    this.users = {}; // Format: { "8462501080": { "nama": "Meningan Pemalang", ... } }
    console.log('📦 UserDatabase instance created');
    this.loadUsers();
  }

  /**
   * Load users from JSON file
   * Supports both old format (object) and new format (array)
   */
  async loadUsers() {
    try {
      const data = await fs.readFile(DB_PATH, 'utf8');
      const parsed = JSON.parse(data);
      
      // DETECT FORMAT: array or object
      if (Array.isArray(parsed)) {
        // NEW FORMAT: Convert array to object format
        this.users = {};
        parsed.forEach(user => {
          if (user && user.id) {
            this.users[user.id] = {
              nama: user.name || user.nama || 'Unknown',
              shortlink: user.shortlink || '',
              destinationUrl: user.articleUrl || user.destinationUrl || '',
              ga4Path: user.ga4Path || this.extractPathFromUrl(user.articleUrl || user.destinationUrl || ''),
              articleTitle: user.articleTitle || this.extractTitleFromUrl(user.articleUrl || user.destinationUrl || ''),
              tanggalDaftar: user.registeredAt || user.tanggalDaftar || new Date().toISOString(),
              didaftarkanOleh: user.didaftarkanOleh || 'admin'
            };
          }
        });
        console.log(`✅ Converted ${parsed.length} users from array format`);
      } else {
        // OLD FORMAT: Already in object format
        this.users = parsed;
        console.log(`✅ Loaded ${Object.keys(this.users).length} users from database (object format)`);
      }
      
      console.log(`   Users loaded: [${Object.keys(this.users).join(', ')}]`);
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, create new
        console.log('📁 Creating new user database file...');
        this.users = {};
        await this.saveUsers();
      } else if (error instanceof SyntaxError) {
        // Invalid JSON
        console.error('❌ Invalid JSON in database file:', error.message);
        console.log('📁 Creating fresh database...');
        this.users = {};
        await this.saveUsers();
      } else {
        console.error('❌ Error loading user database:', error.message);
        this.users = {};
      }
    }
  }

  /**
   * Save users to JSON file
   */
  async saveUsers() {
    try {
      await fs.writeFile(DB_PATH, JSON.stringify(this.users, null, 2), 'utf8');
      console.log(`💾 Saved ${Object.keys(this.users).length} users to database`);
    } catch (error) {
      console.error('❌ Error saving user database:', error.message);
    }
  }

  /**
   * Get user by Telegram ID
   * @param {string} userId - Telegram user ID
   * @returns {object|null} User data or null if not found
   */
  getUser(userId) {
    const id = userId.toString();
    return this.users[id] || null;
  }

  /**
   * Get all users as array
   * @returns {array} Array of user objects
   */
  getAllUsers() {
    return Object.entries(this.users).map(([id, data]) => ({
      id,
      nama: data.nama,
      shortlink: data.shortlink,
      destinationUrl: data.destinationUrl,
      ga4Path: data.ga4Path,
      articleTitle: data.articleTitle,
      tanggalDaftar: data.tanggalDaftar,
      didaftarkanOleh: data.didaftarkanOleh
    }));
  }

  /**
   * Add or update a user
   * @param {string} userId - Telegram user ID
   * @param {object} userData - User data
   * @returns {object} Updated user data
   */
  addUser(userId, userData) {
    const id = userId.toString();
    
    // Prepare user data with defaults
    const now = new Date().toISOString();
    
    this.users[id] = {
      nama: userData.nama || 'Unknown',
      shortlink: userData.shortlink || '',
      destinationUrl: userData.destinationUrl || '',
      ga4Path: userData.ga4Path || this.extractPathFromUrl(userData.destinationUrl || ''),
      articleTitle: userData.articleTitle || this.extractTitleFromUrl(userData.destinationUrl || ''),
      tanggalDaftar: userData.tanggalDaftar || now,
      didaftarkanOleh: userData.didaftarkanOleh || 'admin'
    };
    
    // Auto-extract if missing
    if (!this.users[id].ga4Path && this.users[id].destinationUrl) {
      this.users[id].ga4Path = this.extractPathFromUrl(this.users[id].destinationUrl);
    }
    
    if (!this.users[id].articleTitle && this.users[id].destinationUrl) {
      this.users[id].articleTitle = this.extractTitleFromUrl(this.users[id].destinationUrl);
    }
    
    this.saveUsers();
    console.log(`📝 User ${id} (${this.users[id].nama}) added/updated`);
    return this.users[id];
  }

  /**
   * Delete a user
   * @param {string} userId - Telegram user ID to delete
   * @returns {object|null} Deleted user data or null if not found
   */
  deleteUser(userId) {
    const id = userId.toString();
    const user = this.users[id];
    
    if (user) {
      delete this.users[id];
      this.saveUsers();
      console.log(`🗑️ User ${id} (${user.nama}) deleted`);
      return user;
    }
    
    console.log(`⚠️ User ${id} not found for deletion`);
    return null;
  }

  /**
   * Update user data
   * @param {string} userId - Telegram user ID
   * @param {object} updates - Fields to update
   * @returns {object|null} Updated user or null if not found
   */
  updateUser(userId, updates) {
    const id = userId.toString();
    
    if (!this.users[id]) {
      console.log(`⚠️ User ${id} not found for update`);
      return null;
    }
    
    // Merge updates
    this.users[id] = { ...this.users[id], ...updates };
    
    // Re-extract paths if URL changed
    if (updates.destinationUrl) {
      this.users[id].ga4Path = this.extractPathFromUrl(updates.destinationUrl);
      this.users[id].articleTitle = this.extractTitleFromUrl(updates.destinationUrl);
    }
    
    this.saveUsers();
    console.log(`✏️ User ${id} (${this.users[id].nama}) updated`);
    return this.users[id];
  }

  /**
   * Get user count
   * @returns {number} Number of users
   */
  getUserCount() {
    return Object.keys(this.users).length;
  }

  /**
   * Search users by name
   * @param {string} searchTerm - Name to search for
   * @returns {array} Matching users
   */
  searchUsers(searchTerm) {
    const term = searchTerm.toLowerCase();
    return this.getAllUsers().filter(user => 
      user.nama.toLowerCase().includes(term) || 
      user.id.includes(term)
    );
  }

  /**
   * Export database to array format
   * @returns {array} Users in array format
   */
  exportToArray() {
    return this.getAllUsers();
  }

  /**
   * Backup database to separate file
   */
  async backup() {
    try {
      const backupPath = path.join(__dirname, `user-database-backup-${Date.now()}.json`);
      await fs.writeFile(backupPath, JSON.stringify(this.users, null, 2), 'utf8');
      console.log(`💾 Backup created: ${backupPath}`);
    } catch (error) {
      console.error('❌ Error creating backup:', error.message);
    }
  }

  /**
   * Extract path from URL for GA4 filtering
   * @param {string} url - Full URL
   * @returns {string} Path part
   */
  extractPathFromUrl(url) {
    try {
      if (!url || !url.startsWith('http')) return '/';
      const urlObj = new URL(url);
      return urlObj.pathname || '/';
    } catch (error) {
      console.error('❌ Error extracting path from URL:', url, error.message);
      return '/';
    }
  }

  /**
   * Extract article title from URL
   * @param {string} url - Full URL
   * @returns {string} Article title
   */
  extractTitleFromUrl(url) {
    try {
      if (!url || !url.startsWith('http')) return 'unknown-article';
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(p => p);
      const lastPart = pathParts[pathParts.length - 1] || 'unknown-article';
      
      // Convert kebab-case to readable title
      return lastPart
        .replace(/-/g, ' ')
        .replace(/\b\w/g, char => char.toUpperCase());
    } catch (error) {
      console.error('❌ Error extracting title from URL:', url, error.message);
      return 'unknown-article';
    }
  }
}

// Create singleton instance
const userDatabaseInstance = new UserDatabase();

// Export functions for modules that expect them
module.exports = {
  // Main instance
  getInstance: () => userDatabaseInstance,
  
  // Core functions (used by admin-commands.js and user-commands.js)
  getUser: (userId) => userDatabaseInstance.getUser(userId),
  getAllUsers: () => userDatabaseInstance.getAllUsers(),
  addUser: (userId, userData) => userDatabaseInstance.addUser(userId, userData),
  deleteUser: (userId) => userDatabaseInstance.deleteUser(userId),
  updateUser: (userId, updates) => userDatabaseInstance.updateUser(userId, updates),
  
  // Additional functions
  getUserCount: () => userDatabaseInstance.getUserCount(),
  searchUsers: (term) => userDatabaseInstance.searchUsers(term),
  exportToArray: () => userDatabaseInstance.exportToArray(),
  backup: () => userDatabaseInstance.backup(),
  
  // For backward compatibility and direct access
  users: userDatabaseInstance.users,
  
  // Helper functions (if needed elsewhere)
  extractPathFromUrl: (url) => userDatabaseInstance.extractPathFromUrl(url),
  extractTitleFromUrl: (url) => userDatabaseInstance.extractTitleFromUrl(url)
};
