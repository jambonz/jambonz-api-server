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
  try {
    const hash = JSON.parse(data);
    const decipher = crypto.createDecipheriv(algorithm, secretKey, Buffer.from(hash.iv, 'hex'));
    const decrpyted = Buffer.concat([decipher.update(Buffer.from(hash.content, 'hex')), decipher.final()]);
    return decrpyted.toString();
  } catch (error) {
    console.error('Error while decrypting data', error);
    return '{}';
  }
};

const obscureKey = (key, key_spoiler_length = 6) => {
  const key_spoiler_char = 'X';

  if (!key || key.length <= key_spoiler_length) {
    return key;
  }

  return `${key.slice(0, key_spoiler_length)}${key_spoiler_char.repeat(key.length - key_spoiler_length)}`;
};

function isObscureKey(bucketCredentials) {
  if (!bucketCredentials) {
    return false;
  }

  try {
    const {
      vendor,
      secret_access_key = '',
      service_key = '',
      connection_string = ''
    } = bucketCredentials || {};
    let pattern;
    switch (vendor) {
      case 'aws_s3':
      case 's3_compatible':
        pattern = /^([A-Za-z0-9]{4,6}X+$)/;
        return pattern.test(secret_access_key);
      case 'azure':
        pattern = /^https:[A-Za-z0-9\/.:?=&_-]+$/;
        return pattern.test(connection_string);

      case 'google': {
        pattern = /^([A-Za-z0-9]{4,6}X+$)/;
        let {private_key} = JSON.parse(service_key);
        const key_header = '-----BEGIN PRIVATE KEY-----\n';
        private_key = private_key.slice(key_header.length, private_key.length);
        return pattern.test(private_key || '');
      }
    }
    return false;
  } catch (error) {
    console.log('Error in isObscureKey', error);
    return false;
  }
}

/**
 * obscure sensitive data in bucket credentials
 * an obscured key contains of 6 'spoiled' characters of the key followed by 'X' characters
 * '123456XXXXXXXXXXXXXXXXXXXXXXXX'
 * @param {*} obj
 * @returns
 */
function obscureBucketCredentialsSensitiveData(obj) {
  if (!obj) return obj;
  const {vendor, service_key, connection_string, secret_access_key} = obj;
  switch (vendor) {
    case 'aws_s3':
    case 's3_compatible':
      obj.secret_access_key = obscureKey(secret_access_key);
      break;
    case 'google':
      const o = JSON.parse(service_key);
      let private_key = o.private_key;
      if (!isObscureKey(obj)) {
        const key_header = '-----BEGIN PRIVATE KEY-----\n';
        private_key = o.private_key.slice(key_header.length, o.private_key.length);
        private_key = `${key_header}${obscureKey(private_key)}`;
      }
      const obscured = {
        ...o,
        private_key
      };
      obj.service_key = JSON.stringify(obscured);
      break;
    case 'azure':
      obj.connection_string = obscureKey(connection_string);
      break;
  }

  return obj;
}


module.exports = {
  encrypt,
  decrypt,
  obscureKey,
  isObscureKey,
  obscureBucketCredentialsSensitiveData,
};
