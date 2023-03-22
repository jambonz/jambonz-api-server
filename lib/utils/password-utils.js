const crypto = require('crypto');
const argon2 = require('argon2');
const util = require('util');

const { argon2i } = argon2;

const getRandomBytes = util.promisify(crypto.randomBytes);

const generateHashedPassword = async(password) => {
  const salt = await getRandomBytes(32);
  const passwordHash = await argon2.hash(password, { type: argon2i, salt });
  return passwordHash;
};

const verifyPassword = (passwordHash, password) => {
  return argon2.verify(passwordHash, password);
};

const hashString = (s) => crypto.createHash('md5').update(s).digest('hex');

module.exports = {
  generateHashedPassword,
  verifyPassword,
  hashString
};
