#!/usr/bin/env node
const {getMysqlConnection} = require('../lib/db');
const crypto = require('crypto');
const uuidv4 = require('uuid/v4');
const sqlInsert = `INSERT into users 
(user_sid, name, hashed_password, salt) 
values (?, ?, ?, ?)
`;
const sqlChangeAdminToken = `UPDATE api_keys set token = ? 
WHERE account_sid IS NULL 
AND service_provider_sid IS NULL`;

/**
 * generates random string of characters i.e salt
 * @function
 * @param {number} length - Length of the random string.
 */
const genRandomString = (len) => {
  return crypto.randomBytes(Math.ceil(len / 2))
    .toString('hex') /** convert to hexadecimal format */
    .slice(0, len);   /** return required number of characters */
};

/**
 * hash password with sha512.
 * @function
 * @param {string} password - List of required fields.
 * @param {string} salt - Data to be validated.
 */
const sha512 = function(password, salt) {
  const hash = crypto.createHmac('sha512', salt); /** Hashing algorithm sha512 */
  hash.update(password);
  var value = hash.digest('hex');
  return {
    salt:salt,
    passwordHash:value
  };
};

const saltHashPassword = (userpassword) => {
  var salt = genRandomString(16); /** Gives us salt of length 16 */
  return sha512(userpassword, salt);
};

/* reset admin password */
getMysqlConnection((err, conn) => {
  if (err) return console.log(err, 'Error connecting to database');

  /* delete admin user if it exists */
  conn.query('DELETE from users where name = "admin"', (err) => {
    if (err) return console.log(err, 'Error removing admin user');
    const {salt, passwordHash} = saltHashPassword('admin');
    const sid = uuidv4();
    conn.query(sqlInsert, [
      sid,
      'admin',
      passwordHash,
      salt
    ], (err) => {
      if (err) return console.log(err, 'Error inserting admin user');
      console.log('successfully reset admin password');
      const uuid = uuidv4();
      conn.query(sqlChangeAdminToken, [uuid], (err) => {
        if (err) return console.log(err, 'Error updating admin token');
        console.log('successfully changed admin tokens');
        conn.release();
        process.exit(0);
      });
    });
  });
});
