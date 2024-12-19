#!/usr/bin/env node
const {promisePool} = require('../lib/db');
const { v4: uuidv4 } = require('uuid');
const {generateHashedPassword} = require('../lib/utils/password-utils');
const sqlInsert = `INSERT into users 
(user_sid, name, email, hashed_password, force_change, provider, email_validated) 
values (?, ?, ?, ?, ?, ?, ?)
`;
const sqlInsertAdminToken = `INSERT into api_keys 
(api_key_sid, token) 
values (?, ?)`;
const sqlQueryAccount = 'SELECT * from accounts LEFT JOIN api_keys ON api_keys.account_sid = accounts.account_sid';
const sqlAddAccountToken = `INSERT into api_keys (api_key_sid, token, account_sid) 
VALUES (?, ?, ?)`;
const sqlInsertPermissions = `
INSERT into user_permissions (user_permissions_sid, user_sid, permission_sid) 
VALUES (?,?,?)`;

const password = process.env.JAMBONES_ADMIN_INITIAL_PASSWORD || 'admin';
console.log(`reset_admin_password, initial admin password is ${password}`);

const doIt = async() => {
  const passwordHash = await generateHashedPassword(password);
  const sid = uuidv4();
  await promisePool.execute('DELETE from users where name = "admin"');
  await promisePool.execute('DELETE from api_keys where account_sid is null and service_provider_sid is null');

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
  await promisePool.execute(sqlInsertAdminToken, [uuidv4(), uuidv4()]);

  /* assign all permissions to the admin user */
  const [p] = await promisePool.query('SELECT * from permissions');
  for (const perm of p) {
    await promisePool.execute(sqlInsertPermissions, [uuidv4(), sid, perm.permission_sid]);
  }

  /* create admin token for single account */
  const [r] = await promisePool.query({sql: sqlQueryAccount, nestTables: true});
  if (1 === r.length && r[0].api_keys.api_key_sid === null) {
    const api_key_sid = uuidv4();
    const token = uuidv4();
    const {account_sid} = r[0].accounts;
    await promisePool.execute(sqlAddAccountToken, [api_key_sid, token, account_sid]);
  }

  process.exit(0);
};

doIt();
