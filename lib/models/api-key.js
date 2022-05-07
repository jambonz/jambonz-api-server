const Model = require('./model');
const {getMysqlConnection} = require('../db');

class ApiKey extends Model {
  constructor() {
    super();
  }

  /**
  * list all api keys for an account
  */
  static retrieveAll(account_sid) {
    const sql = account_sid ?
      'SELECT * from api_keys WHERE account_sid = ?' :
      'SELECT * from api_keys WHERE account_sid IS NULL';
    const args = account_sid ? [account_sid] : [];

    return new Promise((resolve, reject) => {
      getMysqlConnection((err, conn) => {
        if (err) return reject(err);
        conn.query(sql, args, (err, results) => {
          conn.release();
          if (err) return reject(err);
          resolve(results);
        });
      });
    });
  }

  /**
  * list all api keys for a service provider
  */
  static retrieveAllForSP(service_provider_sid) {
    const sql = 'SELECT * from api_keys WHERE service_provider_sid = ?';
    const args = [service_provider_sid];

    return new Promise((resolve, reject) => {
      getMysqlConnection((err, conn) => {
        if (err) return reject(err);
        conn.query(sql, args, (err, results) => {
          conn.release();
          if (err) return reject(err);
          resolve(results);
        });
      });
    });
  }

  /**
  * update last_used api key for an account
  */
  static updateLastUsed(account_sid) {
    const sql = 'UPDATE api_keys SET last_used = NOW() WHERE account_sid = ?';
    const args = [account_sid];

    return new Promise((resolve, reject) => {
      getMysqlConnection((err, conn) => {
        if (err) return reject(err);
        conn.query(sql, args, (err, results) => {
          conn.release();
          if (err) return reject(err);
          resolve(results);
        });
      });
    });
  }
}


ApiKey.table = 'api_keys';
ApiKey.fields = [
  {
    name: 'api_key_sid',
    type: 'string',
    primaryKey: true
  },
  {
    name: 'token',
    type: 'string',
    required: true
  },
  {
    name: 'account_sid',
    type: 'string'
  },
  {
    name: 'service_provider_sid',
    type: 'string'
  },
  {
    name: 'expires_at',
    type: 'date'
  },
  {
    name: 'created_at',
    type: 'date'
  },
  {
    name: 'last_used',
    type: 'date'
  }
];

module.exports = ApiKey;
