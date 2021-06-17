const mysql = require('mysql2');
const pool = mysql.createPool({
  host: process.env.JAMBONES_MYSQL_HOST,
  port: process.env.JAMBONES_MYSQL_PORT || 3306,
  user: process.env.JAMBONES_MYSQL_USER,
  password: process.env.JAMBONES_MYSQL_PASSWORD,
  database: process.env.JAMBONES_MYSQL_DATABASE,
  connectionLimit: process.env.JAMBONES_MYSQL_CONNECTION_LIMIT || 10
});
module.exports = pool.promise();
