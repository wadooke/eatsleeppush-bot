// data/user-database.js - Tambah logging
const userDatabase = new Map();

function setupUserDatabase() {
  console.log('💾 Initializing user database...');
  console.log(`   Storage: In-memory (${userDatabase.size} users)`);
  
  // Tampilkan semua user saat startup (untuk debug)
  if (userDatabase.size > 0) {
    console.log('   Existing users on startup:');
    for (const [id, user] of userDatabase) {
      console.log(`     - ${user.nama} (ID: ${id})`);
    }
  }
}

function addUser(telegramId, userData) {
  const userWithId = {
    ...userData,
    id: telegramId, // Pastikan ID ada di data
    tanggalDaftar: new Date().toISOString()
  };
  
  userDatabase.set(telegramId.toString(), userWithId);
  console.log(`✅ User ADDED to database: ${userData.nama} (ID: ${telegramId})`);
  console.log(`   Total users now: ${userDatabase.size}`);
  
  // Debug: Tampilkan semua user setelah penambahan
  console.log('   Current database state:');
  for (const [id, user] of userDatabase) {
    console.log(`     - ${user.nama} (${id})`);
  }
  
  return userWithId;
}

function getAllUsers() {
  console.log(`📋 Getting ALL users: ${userDatabase.size} found`);
  const users = [];
  for (const [id, data] of userDatabase) {
    users.push({ id, ...data });
  }
  return users;
}
