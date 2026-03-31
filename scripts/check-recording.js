#!/usr/bin/env node
'use strict';

const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');

/* load env vars from ecosystem.config.js */
const ecosystem = require(path.resolve(process.env.HOME, 'apps', 'ecosystem.config.js'));
const envVars = {};
for (const app of ecosystem.apps) {
  Object.assign(envVars, app.env);
}

const encryptionSecret = envVars.ENCRYPTION_SECRET || envVars.JWT_SECRET;
if (!encryptionSecret) {
  console.error('Error: no ENCRYPTION_SECRET or JWT_SECRET found in ecosystem.config.js');
  process.exit(1);
}

const accountSid = process.argv[2];
if (!accountSid) {
  console.error('Usage: node check-recording.js <account_sid>');
  process.exit(1);
}

/* decrypt using the same logic as jambonz-api-server */
function decrypt(data) {
  const algorithm = envVars.LEGACY_CRYPTO ? 'aes-256-ctr' : 'aes-256-cbc';
  const secretKey = crypto.createHash('sha256')
    .update(encryptionSecret)
    .digest('base64')
    .substring(0, 32);

  const hash = JSON.parse(data);
  const decipher = crypto.createDecipheriv(algorithm, secretKey, Buffer.from(hash.iv, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(hash.content, 'hex')), decipher.final()]).toString();
}

async function main() {
  const conn = await mysql.createConnection({
    host: envVars.JAMBONES_MYSQL_HOST,
    user: envVars.JAMBONES_MYSQL_USER,
    password: envVars.JAMBONES_MYSQL_PASSWORD,
    database: envVars.JAMBONES_MYSQL_DATABASE,
  });

  try {
    const [rows] = await conn.execute(
      'SELECT name, record_all_calls, record_format, bucket_credential FROM accounts WHERE account_sid = ?',
      [accountSid]
    );

    if (rows.length === 0) {
      console.error(`No account found with account_sid: ${accountSid}`);
      process.exit(1);
    }

    const account = rows[0];
    console.log(`Account: ${account.name} (${accountSid})`);
    console.log(`Recording enabled: ${account.record_all_calls ? 'YES' : 'NO'}`);

    if (!account.record_all_calls) {
      process.exit(0);
    }

    console.log(`Record format: ${account.record_format}`);

    if (!account.bucket_credential) {
      console.log('Bucket credential: (none configured)');
      process.exit(0);
    }

    const cred = JSON.parse(decrypt(account.bucket_credential));
    console.log('\nBucket credential:');
    console.log(JSON.stringify(cred, null, 2));
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
