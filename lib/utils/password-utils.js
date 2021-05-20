const crypto = require('crypto');
const { argon2i } = require('argon2-ffi');
const util = require('util');

const getRandomBytes = util.promisify(crypto.randomBytes);

const generateHashedPassword = async(password) => {
  const salt = await getRandomBytes(32);
  const passwordHash =  await argon2i.hash(password, salt);
  return passwordHash;
};

const verifyPassword = async(passwordHash, password) => {
  const isCorrect = await argon2i.verify(passwordHash, password);
  return isCorrect;
};

const hashString = (s) => crypto.createHash('md5').update(s).digest('hex');

module.exports = {
  generateHashedPassword,
  verifyPassword,
  hashString
};
