const { query } = require('../db/mysql');

async function findUserPasswordById(userId) {
  const rows = await query(
    `
      SELECT id, password
      FROM users
      WHERE id = ?
        AND is_deleted = 0
      LIMIT 1
    `,
    [userId]
  );

  return rows[0] || null;
}

async function updateUserPasswordById(userId, passwordHash, changedBy) {
  const result = await query(
    `
      UPDATE users
      SET password = ?,
          changed_by = ?
      WHERE id = ?
        AND is_deleted = 0
    `,
    [passwordHash, changedBy, userId]
  );

  return result.affectedRows || 0;
}

module.exports = {
  findUserPasswordById,
  updateUserPasswordById
};