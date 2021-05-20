#!/usr/bin/env node
console.log('reset_admin_password');
const {getMysqlConnection} = require('../lib/db');
const uuidv4 = require('uuid/v4');
const {generateHashedPassword} = require('../lib/utils/password-utils');
const sqlInsert = `INSERT into users 
(user_sid, name, email, hashed_password, force_change, provider, email_validated) 
values (?, ?, ?, ?, ?, ?, ?)
`;
const sqlChangeAdminToken = `UPDATE api_keys set token = ? 
WHERE account_sid IS NULL 
AND service_provider_sid IS NULL`;

/* reset admin password */
console.log('reset_admin_password');
getMysqlConnection((err, conn) => {
  if (err) return console.log(err, 'Error connecting to database');
  console.log('got database connetion');

  /* delete admin user if it exists */
  conn.query('DELETE from users where name = "admin"', async(err) => {
    if (err) return console.log(err, 'Error removing admin user');
    console.log('deleted existing admin user');
    const passwordHash = await generateHashedPassword('admin');
    const sid = uuidv4();
    conn.query(sqlInsert, [
      sid,
      'admin',
      'joe@foo.bar',
      passwordHash,
      1,
      'local',
      1
    ], (err) => {
      if (err) {
        console.log(err, 'Error inserting admin user');
        throw err;
      }
      console.log('successfully reset admin password');
      const uuid = uuidv4();
      conn.query(sqlChangeAdminToken, [uuid], (err) => {
        if (err) {
          console.log(err, 'Error updating admin token');
          throw err;
        }
        console.log('successfully changed admin tokens');
        conn.release();
        process.exit(0);
      });
    });
  });
});
