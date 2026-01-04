// data/user-database.js - PASTIKAN SEPERTI INI
const fs = require('fs').promises;
const path = require('path');

const DB_PATH = path.join(__dirname, 'user-database.json');

class UserDatabase {
  constructor() {
    this.users = {}; // Format: { "8462501080": { "nama": "Meningan Pemalang", ... } }
    this.loadUsers();
  }

  async loadUsers() {
    try {
      const data = await fs.readFile(DB_PATH, 'utf8');
      const parsed = JSON.parse(data);
      
      // Deteksi format
      if (Array.isArray(parsed)) {
        // Convert array ke format object
        this.users = {};
        parsed.forEach(user => {
          if (user.id) {
            this.users[user.id] = {
              nama: user.name || user.nama,
              shortlink: user.shortlink,
              destinationUrl: user.articleUrl || user.destinationUrl,
              ga4Path: user.ga4Path || this.extractPathFromUrl(user.articleUrl || user.destinationUrl),
              articleTitle: user.articleTitle || this.extractTitleFromUrl(user.articleUrl || user.destinationUrl),
              tanggalDaftar: user.registeredAt || new Date().toISOString()
            };
          }
        });
        console.log(`✅ Converted ${parsed.length} users from new format`);
      } else {
        // Format lama (object)
        this.users = parsed;
        console.log(`✅ Loaded ${Object.keys(this.users).length} users from database`);
      }
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('📁 Creating new user database...');
        this.users = {};
        await this.saveUsers();
      } else {
        console.error('❌ Error loading user database:', error.message);
        this.users = {};
      }
    }
  }

  async saveUsers() {
    try {
      await fs.writeFile(DB_PATH, JSON.stringify(this.users, null, 2), 'utf8');
    } catch (error) {
      console.error('❌ Error saving user database:', error.message);
    }
  }

  // ... (fungsi-fungsi lainnya tetap sama) ...

  extractPathFromUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname;
    } catch {
      return '/';
    }
  }

  extractTitleFromUrl(url) {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(p => p);
      return pathParts[pathParts.length - 1] || 'unknown';
    } catch {
      return 'unknown';
    }
  }
}

// Ekspor instance singleton - TIDAK ADA setupUserDatabase()
module.exports = new UserDatabase();
