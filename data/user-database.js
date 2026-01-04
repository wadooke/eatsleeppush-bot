// data/user-database.js
const userDatabase = new Map();

function setupUserDatabase() {
  console.log('💾 Initializing user database...');
  console.log(`   Storage: In-memory (${userDatabase.size} users)`);
}

function addUser(telegramId, userData) {
  userDatabase.set(telegramId.toString(), {
    ...userData,
    id: telegramId, // Tambahkan ID ke data user
    tanggalDaftar: new Date().toISOString()
  });
  console.log(`   ✅ User added: ${userData.nama} (ID: ${telegramId})`);
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
    console.log(`   🗑️ User deleted: ${user.nama} (ID: ${telegramId})`);
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
