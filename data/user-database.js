// data/user-database.js - UPDATE UNTUK SUPPORT BOTH FORMATS
const fs = require('fs').promises;
const path = require('path');

const DB_PATH = path.join(__dirname, 'user-database.json');

// Format data lama (current)
// { "8462501080": { "nama": "Meningan Pemalang", "shortlink": "...", ... } }

// Format data baru (proposed)
// [{ "id": "8462501080", "name": "Meningan Pemalang", ... }]

class UserDatabase {
  constructor() {
    this.users = {}; // Format lama untuk backward compatibility
    this.loadUsers();
  }

  async loadUsers() {
    try {
      const data = await fs.readFile(DB_PATH, 'utf8');
      const parsed = JSON.parse(data);
      
      // Deteksi format: array atau object
      if (Array.isArray(parsed)) {
        // Convert array format baru ke format lama
        this.users = {};
        parsed.forEach(user => {
          if (user.id) {
            this.users[user.id] = {
              nama: user.name || user.nama,
              shortlink: user.shortlink,
              destinationUrl: user.articleUrl || user.destinationUrl,
              ga4Path: user.ga4Path || extractPathFromUrl(user.articleUrl || user.destinationUrl),
              tanggalDaftar: user.registeredAt || new Date().toISOString()
            };
          }
        });
        console.log(`✅ Converted ${parsed.length} users from new format`);
      } else {
        // Format lama (object)
        this.users = parsed;
        console.log(`✅ Loaded ${Object.keys(this.users).length} users from database (old format)`);
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
      // Simpan dalam format lama untuk compatibility
      await fs.writeFile(DB_PATH, JSON.stringify(this.users, null, 2), 'utf8');
      console.log(`💾 Saved ${Object.keys(this.users).length} users to database`);
    } catch (error) {
      console.error('❌ Error saving user database:', error.message);
    }
  }

  // GETTERS (compatible dengan kode lama)
  getUser(userId) {
    return this.users[userId.toString()] || null;
  }

  getAllUsers() {
    return Object.entries(this.users).map(([id, data]) => ({
      id,
      ...data
    }));
  }

  // SETTERS (compatible dengan kode lama)
  addUser(userId, userData) {
    this.users[userId.toString()] = {
      ...userData,
      tanggalDaftar: new Date().toISOString()
    };
    this.saveUsers();
    return this.users[userId];
  }

  deleteUser(userId) {
    const user = this.users[userId.toString()];
    if (user) {
      delete this.users[userId.toString()];
      this.saveUsers();
      return user;
    }
    return null;
  }
}

// Helper function
function extractPathFromUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.pathname;
  } catch {
    return '/';
  }
}

// Export instance singleton (format lama tetap compatible)
module.exports = new UserDatabase();
