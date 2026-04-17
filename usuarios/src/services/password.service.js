const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const BCRYPT_ROUNDS = 10;
const SCRYPT_KEYLEN = 64;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

function scryptAsync(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(
      password,
      salt,
      SCRYPT_KEYLEN,
      { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(derivedKey);
      }
    );
  });
}

async function hashPassword(rawPassword) {
  return bcrypt.hash(rawPassword, BCRYPT_ROUNDS);
}

async function verifyPassword(rawPassword, storedHash) {
  if (!storedHash || typeof storedHash !== 'string') {
    return false;
  }

  if (/^\$2[aby]\$\d{2}\$/.test(storedHash)) {
    return bcrypt.compare(rawPassword, storedHash);
  }

  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return false;
  }

  const [, salt, hashHex] = parts;
  const expected = Buffer.from(hashHex, 'hex');
  const candidate = await scryptAsync(rawPassword, salt);

  if (expected.length !== candidate.length) {
    return false;
  }

  return crypto.timingSafeEqual(expected, candidate);
}

module.exports = {
  hashPassword,
  verifyPassword
};
