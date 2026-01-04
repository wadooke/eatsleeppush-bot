// data/user-database.js - DENGAN EKSPOR YANG BENAR
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'users.json');
let userDatabase = new Map();

function setupUserDatabase() {
  console.log('💾 Initializing user database...');
  
  try {
    // Coba load dari file
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      const users = JSON.parse(data);
      
      // Load ke Map
      for (const user of users) {
        userDatabase.set(user.id.toString(), user);
      }
      
      console.log(`   ✅ Loaded ${userDatabase.size} users from file`);
      console.log('   Users:', Array.from(userDatabase.keys()));
    } else {
      console.log('   ℹ️ No existing data file, starting fresh');
      // Buat file kosong
      fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2));
    }
  } catch (error) {
    console.error('❌ Error loading database:', error.message);
    console.log('   Starting with empty database');
  }
}

function addUser(telegramId, userData) {
  const userWithId = {
    ...userData,
    id: telegramId.toString(),
    tanggalDaftar: new Date().toISOString()
  };
  
  userDatabase.set(telegramId.toString(), userWithId);
  saveToFile();
  
  console.log(`✅ User ADDED: ${userData.nama} (ID: ${telegramId})`);
  console.log(`   Total users: ${userDatabase.size}`);
  return userWithId;
}

function getUser(telegramId) {
  return userDatabase.get(telegramId.toString());
}

function getAllUsers() {
  const users = [];
  for (const [id, data] of userDatabase) {
    users.push({ id, ...data });
  }
  console.log(`📋 getAllUsers: ${users.length} users found`);
  return users;
}

function deleteUser(telegramId) {
  const user = getUser(telegramId);
  if (user) {
    userDatabase.delete(telegramId.toString());
    saveToFile();
    console.log(`🗑️ User DELETED: ${user.nama} (ID: ${telegramId})`);
  }
  return user;
}

function getUserCount() {
  return userDatabase.size;
}

function saveToFile() {
  try {
    const usersArray = [];
    for (const [id, user] of userDatabase) {
      usersArray.push(user);
    }
    
    fs.writeFileSync(DATA_FILE, JSON.stringify(usersArray, null, 2));
    console.log(`💾 Database saved: ${usersArray.length} users`);
  } catch (error) {
    console.error('❌ Error saving database:', error.message);
  }
}

// EKSPOR SEMUA FUNGSI YANG DIPERLUKAN
module.exports = {
  setupUserDatabase,
  addUser,
  getUser,
  getAllUsers,
  deleteUser,
  getUserCount,
  saveToFile  // tambahkan ini jika perlu
};
