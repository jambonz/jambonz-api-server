const Model = require('./model');
const {getMysqlConnection} = require('../db');
const listSqlSp = `
SELECT * from applications
WHERE account_sid in (
  SELECT account_sid from accounts
  WHERE service_provider_sid = ?
)`;
const listSqlAccount = 'SELECT * from applications WHERE account_sid = ?';
const retrieveSqlSp = `
SELECT * from applications
WHERE account_sid in (
  SELECT account_sid from accounts
  WHERE service_provider_sid = ?
)
AND application_sid = ?`;
const retrieveSqlAccount = `
SELECT * from applications
WHERE account_sid = ?
AND application_sid = ?`;

class Application extends Model {
  constructor() {
    super();
  }

  /**
   * list all applications - for all service providers, for one service provider, or for one account
   */
  static retrieveAll(service_provider_sid, account_sid) {
    if (!service_provider_sid && !account_sid) return super.retrieveAll();
    return new Promise((resolve, reject) => {
      getMysqlConnection((err, conn) => {
        if (err) return reject(err);
        const sql = account_sid ? listSqlAccount : listSqlSp;
        const args = account_sid ? [account_sid] : [service_provider_sid];
        conn.query(sql, args, (err, results, fields) => {
          conn.release();
          if (err) return reject(err);
          resolve(results);
        });
      });
    });
  }

  /**
   * retrieve an application
   */
  static retrieve(sid, service_provider_sid, account_sid) {
    if (!service_provider_sid && !account_sid) return super.retrieve(sid);
    return new Promise((resolve, reject) => {
      getMysqlConnection((err, conn) => {
        if (err) return reject(err);
        const sql = account_sid ? retrieveSqlAccount : retrieveSqlSp;
        const args = account_sid ? [account_sid, sid] : [service_provider_sid, sid];
        conn.query(sql, args, (err, results, fields) => {
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
  },
  {
    name: 'hook_basic_auth_user',
    type: 'string',
  },
  {
    name: 'hook_basic_auth_password',
    type: 'string',
  },
  {
    name: 'hook_http_method',
    type: 'string',
  }
];

module.exports = Application;
