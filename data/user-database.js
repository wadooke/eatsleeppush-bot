// data/user-database.js - User database management
const userDatabase = new Map();

function setupUserDatabase() {
  console.log('💾 Initializing user database...');
  console.log(`   Storage: In-memory (${userDatabase.size} users)`);
  
  // Load from file if exists (for persistence)
  // You can implement file-based persistence here
}

function addUser(telegramId, userData) {
  userDatabase.set(telegramId.toString(), {
    ...userData,
    tanggalDaftar: new Date().toISOString()
  });
  return userDatabase.get(telegramId.toString());
}

function getUser(telegramId) {
  return userDatabase.get(telegramId.toString());
}

function getAllUsers() {
  const users = [];
  for (const [id, data] of userDatabase) {
    users.push({ id, ...data });
  }
  return users;
}

function deleteUser(telegramId) {
  const user = getUser(telegramId);
  if (user) {
    userDatabase.delete(telegramId.toString());
  }
  return user;
}

function getUserCount() {
  return userDatabase.size;
}

module.exports = {
  setupUserDatabase,
  addUser,
  getUser,
  getAllUsers,
  deleteUser,
  getUserCount
};
