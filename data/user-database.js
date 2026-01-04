// data/user-database.js
const fs = require('fs').promises;
const path = require('path');

const DB_PATH = path.join(__dirname, 'user-database.json');

class UserDatabase {
  constructor() {
    this.users = [];
    this.loadUsers();
  }

  async loadUsers() {
    try {
      const data = await fs.readFile(DB_PATH, 'utf8');
      this.users = JSON.parse(data);
      console.log(`✅ Loaded ${this.users.length} users from database`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File tidak ada, buat baru
        console.log('📁 Creating new user database...');
        this.users = [];
        await this.saveUsers();
      } else {
        console.error('❌ Error loading user database:', error.message);
        this.users = [];
      }
    }
  }

  async saveUsers() {
    try {
      await fs.writeFile(DB_PATH, JSON.stringify(this.users, null, 2), 'utf8');
      console.log(`💾 Saved ${this.users.length} users to database`);
    } catch (error) {
      console.error('❌ Error saving user database:', error.message);
    }
  }

  getUser(userId) {
    return this.users.find(user => user.id === userId.toString());
  }

  getAllUsers() {
    return [...this.users];
  }

  async addUser(userData) {
    // Pastikan tidak ada duplikat
    const existingIndex = this.users.findIndex(u => u.id === userData.id);
    
    if (existingIndex >= 0) {
      // Update user yang sudah ada
      this.users[existingIndex] = { ...this.users[existingIndex], ...userData };
    } else {
      // Tambah user baru
      this.users.push({
        ...userData,
        registeredAt: new Date().toISOString(),
        status: 'active'
      });
    }
    
    await this.saveUsers();
    return userData;
  }

  async deleteUser(userId) {
    const initialLength = this.users.length;
    this.users = this.users.filter(user => user.id !== userId.toString());
    
    if (this.users.length < initialLength) {
      await this.saveUsers();
      return true; // Berhasil dihapus
    }
    return false; // User tidak ditemukan
  }

  async updateUser(userId, updates) {
    const userIndex = this.users.findIndex(u => u.id === userId.toString());
    
    if (userIndex >= 0) {
      this.users[userIndex] = { ...this.users[userIndex], ...updates };
      await this.saveUsers();
      return this.users[userIndex];
    }
    return null;
  }
}

// Ekspor instance singleton
module.exports = new UserDatabase();
