const userPasswordDAO = require('../daos/user-password.dao');

async function getUserPasswordById(userId) {
  return userPasswordDAO.findUserPasswordById(userId);
}

async function updateUserPasswordById(userId, passwordHash, changedBy) {
  return userPasswordDAO.updateUserPasswordById(userId, passwordHash, changedBy);
}

module.exports = {
  getUserPasswordById,
  updateUserPasswordById
};
