const Model = require('./model');
const {getMysqlConnection} = require('../db');

const retrieveSql = `SELECT * from applications app
LEFT JOIN webhooks AS ch
ON app.call_hook_sid = ch.webhook_sid
LEFT JOIN webhooks AS sh
ON app.call_status_hook_sid = sh.webhook_sid 
LEFT JOIN webhooks AS mh
ON app.messaging_hook_sid = mh.webhook_sid`;

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
    if (row.mh && Object.keys(row.mh).length && row.mh.url !== null) {
      Object.assign(obj, {messaging_hook: row.mh});
    }
    else obj.messaging_hook = null;
    delete obj.call_hook_sid;
    delete obj.call_status_hook_sid;
    delete obj.messaging_hook_sid;
    return obj;
  });
}

class Application extends Model {
  constructor() {
    super();
  }

  static _criteriaBuilder(obj, args) {
    let sql = '';
    if (obj.account_sid) {
      sql += ' AND app.account_sid = ?';
      args.push(obj.account_sid);
    }
    if (obj.service_provider_sid) {
      sql += ' AND app.account_sid in (SELECT account_sid from accounts WHERE service_provider_sid = ?)';
      args.push(obj.service_provider_sid);
    }
    if (obj.name) {
      sql += ' AND app.name LIKE ?';
      args.push(`%${obj.name}%`);
    }
    return sql;
  }

  static countAll(obj) {
    const args = [];
    const criteriaClause = Application._criteriaBuilder(obj, args);

    // Only use "WHERE 1 = 1" if there are no filters
    // Otherwise start with the actual filter for better index usage
    let sql;
    if (criteriaClause) {
      // Remove leading ' AND ' from criteriaBuilder output and use as WHERE clause
      sql = 'SELECT COUNT(*) AS count FROM applications app WHERE ' + criteriaClause.substring(5);
    } else {
      // No filters provided - count all applications
      sql = 'SELECT COUNT(*) AS count FROM applications app WHERE 1 = 1';
    }
    return new Promise((resolve, reject) => {
      getMysqlConnection((err, conn) => {
        if (err) return reject(err);
        conn.query({sql}, args, (err, results) => {
          conn.release();
          if (err) return reject(err);
          resolve(results[0].count);
        });
      });
    });
  }

  /**
   * list all applications - for all service providers, for one service provider, or for one account,
   * or by an optional name
   */
  static retrieveAll(obj) {
    const { page, page_size = 50 } = obj || {};

    // If pagination is requested, first get the application IDs
    if (page !== null && page !== undefined) {
      let idSql = 'SELECT application_sid, name FROM applications app WHERE 1 = 1';
      const idArgs = [];
      idSql += Application._criteriaBuilder(obj, idArgs);
      idSql += ' ORDER BY app.name';

      const limit = Number(page_size);
      const offset = Number(page > 0 ? (page - 1) : page) * limit;
      idSql += ' LIMIT ? OFFSET ?';
      idArgs.push(limit);
      idArgs.push(offset);

      return new Promise((resolve, reject) => {
        getMysqlConnection((err, conn) => {
          if (err) return reject(err);

          // Get paginated application IDs
          conn.query(idSql, idArgs, (err, idResults) => {
            if (err) {
              conn.release();
              return reject(err);
            }

            if (idResults.length === 0) {
              conn.release();
              return resolve([]);
            }

            // Get full data for these applications
            const appIds = idResults.map((row) => row.application_sid);
            const placeholders = appIds.map(() => '?').join(',');
            const fullSql = `${retrieveSql}
              WHERE app.application_sid IN (${placeholders}) ORDER BY app.name`;

            conn.query({sql: fullSql, nestTables: true}, appIds, (err, results) => {
              conn.release();
              if (err) return reject(err);
              const r = transmogrifyResults(results);
              resolve(r);
            });
          });
        });
      });
    }

    // No pagination - use original query
    const args = [];
    const criteriaClause = Application._criteriaBuilder(obj, args);

    // Only use "WHERE 1 = 1" if there are no filters
    // Otherwise start with the actual filter for better index usage
    let sql;
    if (criteriaClause) {
      // Remove leading ' AND ' from criteriaBuilder output and use as WHERE clause
      sql = retrieveSql + ' WHERE ' + criteriaClause.substring(5);
    } else {
      // No filters provided - must list all applications
      sql = retrieveSql + ' WHERE 1 = 1';
    }
    sql += ' ORDER BY app.application_sid';

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
  },
  {
    name: 'call_status_hook_sid',
    type: 'string',
  },
  {
    name: 'messaging_hook_sid',
    type: 'string',
  },
  {
    name: 'record_all_calls',
    type: 'number',
  }
];

module.exports = Application;
