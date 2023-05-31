const crypto = require('crypto');
const algorithm = process.env.LEGACY_CRYPTO ? 'aes-256-ctr' : 'aes-256-cbc';
const iv = crypto.randomBytes(16);
const secretKey = crypto.createHash('sha256')
  .update(process.env.ENCRYPTION_SECRET || process.env.JWT_SECRET)
  .digest('base64')
  .substring(0, 32);

const encrypt = (text) => {
  const cipher = crypto.createCipheriv(algorithm, secretKey, iv);
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
  const data = {
    iv: iv.toString('hex'),
    content: encrypted.toString('hex')
  };
  return JSON.stringify(data);
};

const decrypt = (data) => {
  const hash = JSON.parse(data);
  const decipher = crypto.createDecipheriv(algorithm, secretKey, Buffer.from(hash.iv, 'hex'));
  const decrpyted = Buffer.concat([decipher.update(Buffer.from(hash.content, 'hex')), decipher.final()]);
  return decrpyted.toString();
};

const obscureKey = (key) => {
  const key_spoiler_length = 6;
  const key_spoiler_char = 'X';

  if (!key || key.length <= key_spoiler_length) {
    return key;
  }

  return `${key.slice(0, key_spoiler_length)}${key_spoiler_char.repeat(key.length - key_spoiler_length)}`;
};

module.exports = {
  encrypt,
  decrypt,
  obscureKey
};
