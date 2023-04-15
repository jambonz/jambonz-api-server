const Model = require('./model');
const {getMysqlConnection} = require('../db');

class Lcr extends Model {
  constructor() {
    super();
  }

  static retrieveAllByAccountSid(sid) {
    const args = [sid];
    const sql = `SELECT * FROM ${this.table} WHERE account_sid = ?`;
    return new Promise((resolve, reject) => {
      getMysqlConnection((err, conn) => {
        if (err) return reject(err);
        conn.query({sql, nestTables: true}, args, (err, results, fields) => {
          conn.release();
          if (err) return reject(err);
          resolve(results);
        });
      });
    });
  }

  static retrieveAllByServiceProviderSid(sid) {
    const args = [sid];
    const sql = `SELECT * FROM ${this.table} WHERE service_provider_sid = ?`;
    return new Promise((resolve, reject) => {
      getMysqlConnection((err, conn) => {
        if (err) return reject(err);
        conn.query({sql, nestTables: true}, args, (err, results, fields) => {
          conn.release();
          if (err) return reject(err);
          resolve(results);
        });
      });
    });
  }

  static retrieveBySid(sid) {
    const args = [sid];
    const sql = `SELECT * FROM ${this.table} WHERE lcr_sid = ?`;
    return new Promise((resolve, reject) => {
      getMysqlConnection((err, conn) => {
        if (err) return reject(err);
        conn.query({sql, nestTables: true}, args, (err, results, fields) => {
          conn.release();
          if (err) return reject(err);
          resolve(results.length > 0 ? results[0] : null);
        });
      });
    });
  }
}

Lcr.table = 'lcr';
Lcr.fields = [
  {
    name: 'lcr_sid',
    type: 'string',
    primaryKey: true
  },
  {
    name: 'name',
    type: 'string'
  },
  {
    name: 'default_carrier_set_entry_sid',
    type: 'string'
  }
];

module.exports = Lcr;
