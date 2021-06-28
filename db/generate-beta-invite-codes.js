#!/usr/bin/env node
const crypto = require('crypto');
const {promisePool} = require('../lib/db');
const sql = 'INSERT INTO beta_invite_codes (invite_code) VALUES (?);';

const rand_string = (n) => {
  if (n <= 0) {
    return '';
  }
  var rs = '';
  try {
    rs = crypto.randomBytes(Math.ceil(n/2)).toString('hex').slice(0,n);
    /* note: could do this non-blocking, but still might fail */
  }
  catch (ex) {
    /* known exception cause: depletion of entropy info for randomBytes */
    console.error('Exception generating random string: ' + ex);
    /* weaker random fallback */
    rs = '';
    var r = n % 8, q = (n - r) / 8, i;
    for (i = 0; i < q; i++) {
      rs += Math.random().toString(16).slice(2);
    }
    if (r > 0) {
      rs += Math.random().toString(16).slice(2, i);
    }
  }
  return rs;
};

const doIt = async(len) => {
  for (let i = 0; i < 50; i++) {
    const val = rand_string(len).toUpperCase();
    await promisePool.execute(sql, [val]);
  }
  process.exit(0);
};

doIt(6);

