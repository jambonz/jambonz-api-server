const mysql = require('mysql');
const config = require('config');
const pool = mysql.createPool(config.get('mysql'));

pool.getConnection((err, conn) => {
  if (err) return console.error(err, 'Error testing pool');
  conn.ping((err) => {
    if (err) return console.error(err, `Error pinging mysql at ${JSON.stringify(config.get('mysql'))}`);
  });
});

module.exports = pool.getConnection.bind(pool);
