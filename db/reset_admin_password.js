#!/usr/bin/env node
console.log('reset_admin_password');
const {promisePool} = require('../lib/db');
const uuidv4 = require('uuid/v4');
const {generateHashedPassword} = require('../lib/utils/password-utils');
const sqlInsert = `INSERT into users 
(user_sid, name, email, hashed_password, force_change, provider, email_validated) 
values (?, ?, ?, ?, ?, ?, ?)
`;
const sqlChangeAdminToken = `UPDATE api_keys set token = ? 
WHERE account_sid IS NULL 
AND service_provider_sid IS NULL`;
const sqlQueryAccount = 'SELECT * from accounts LIMIT 1';
const sqlAddAccountAdminToken = `INSERT into api_keys (api_key_sid, token, account_sid) 
VALUES (?, ?, ?)`;

const doIt = async() => {
  const passwordHash = await generateHashedPassword('admin');
  const sid = uuidv4();
  await promisePool.execute('DELETE from users where name = "admin"');
  await promisePool.execute(sqlInsert, 
    [
      sid,
      'admin',
      'joe@foo.bar',
      passwordHash,
      1,
      'local',
      1
    ]
  );

  /* reset admin token */
  const uuid = uuidv4();
  await promisePool.query(sqlChangeAdminToken, [uuid]);

  /* create admin token for single account */
  const api_key_sid = uuidv4();
  const token = uuidv4();
  const [r] = await promisePool.query(sqlQueryAccount);
  if (r.length > 0) {
    await promisePool.execute(sqlAddAccountAdminToken, [api_key_sid, token, r[0].account_sid]);
  }

  process.exit(0);
};

doIt();
