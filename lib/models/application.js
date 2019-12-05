const Model = require('./model');
const {getMysqlConnection} = require('../db');
const serviceProviderSql = `
SELECT * from ${this.table}
WHERE account_sid in (
  SELECT account_sid from accounts
  WHERE service_provider_sid = ?
)`;

class Application extends Model {
  constructor() {
    super();
  }

  /**
   * retrieve all applications for an account
   */
  static retrieveAllForAccount(account_sid) {
    return new Promise((resolve, reject) => {
      getMysqlConnection((err, conn) => {
        if (err) return reject(err);
        conn.query(`SELECT * from ${this.table} WHERE account_sid = ?`, [account_sid], (err, results, fields) => {
          conn.release();
          if (err) return reject(err);
          resolve(results);
        });
      });
    });
  }

  /**
   * retrieve all applications for a service provider
   */
  static retrieveAllForServiceProvider(service_provider_sid) {
    return new Promise((resolve, reject) => {
      getMysqlConnection((err, conn) => {
        if (err) return reject(err);
        conn.query(serviceProviderSql, [service_provider_sid], (err, results, fields) => {
          conn.release();
          if (err) return reject(err);
          resolve(results);
        });
      });
    });
  }
}

Application.table = 'applications';
Application.fields = [
  {
    name: 'application_sid',
    type: 'string',
    primaryKey: true
  },
  {
    name: 'name',
    type: 'string',
    required: true
  },
  {
    name: 'account_sid',
    type: 'string',
    required: true
  },
  {
    name: 'call_hook',
    type: 'string',
    required: true
  },
  {
    name: 'call_status_hook',
    type: 'string',
    required: true
  }
];

module.exports = Application;
