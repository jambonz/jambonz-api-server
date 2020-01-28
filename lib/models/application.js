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

const retrieveSql = `SELECT * from applications app
LEFT JOIN webhooks AS ch
ON app.call_hook_sid = ch.webhook_sid
LEFT JOIN webhooks AS sh
ON app.call_status_hook_sid = sh.webhook_sid`;

function transmogrifyResults(results) {
  return results.map((row) => {
    const obj = row.app;
    if (row.ch && Object.keys(row.ch).length && row.ch.url !== null) {
      Object.assign(obj, {call_hook: row.ch});
    }
    else obj.call_hook = null;
    if (row.sh && Object.keys(row.sh).length && row.sh.url !== null) {
      Object.assign(obj, {call_status_hook: row.sh});
    }
    else obj.call_status_hook = null;
    delete obj.call_hook_sid;
    delete obj.call_status_hook_sid;
    return obj;
  });
}

class Application extends Model {
  constructor() {
    super();
  }

  /**
   * list all applications - for all service providers, for one service provider, or for one account
   */
  static retrieveAll(service_provider_sid, account_sid) {
    let sql = retrieveSql;
    const args = [];
    if (account_sid) {
      sql = `${sql} WHERE app.account_sid = ?`;
      args.push(account_sid);
    }
    else if (service_provider_sid) {
      sql = `${sql} WHERE account_sid in (SELECT account_sid from accounts WHERE service_provider_sid = ?)`;
      args.push(service_provider_sid);
    }
    return new Promise((resolve, reject) => {
      getMysqlConnection((err, conn) => {
        if (err) return reject(err);
        conn.query({sql, nestTables: true}, args, (err, results, fields) => {
          conn.release();
          if (err) return reject(err);
          const r = transmogrifyResults(results);
          resolve(r);
        });
      });
    });
  }

  /**
   * retrieve an application
   */
  static retrieve(sid, service_provider_sid, account_sid) {
    const args = [sid];
    let sql = `${retrieveSql} WHERE app.application_sid = ?`;
    if (account_sid) {
      sql = `${sql} AND app.account_sid = ?`;
      args.push(account_sid);
    }
    if (service_provider_sid) {
      sql = `${sql} AND account_sid in (SELECT account_sid from accounts WHERE service_provider_sid = ?)`;
      args.push(service_provider_sid);
    }
    return new Promise((resolve, reject) => {
      getMysqlConnection((err, conn) => {
        if (err) return reject(err);
        conn.query({sql, nestTables: true}, args, (err, results, fields) => {
          conn.release();
          if (err) return reject(err);
          const r = transmogrifyResults(results);
          resolve(r);
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
    name: 'call_hook_sid',
    type: 'string',
    required: true
  },
  {
    name: 'call_status_hook_sid',
    type: 'string',
    required: true
  }
];

module.exports = Application;
