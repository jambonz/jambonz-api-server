const Model = require('./model');
const {getMysqlConnection} = require('../db');

const retrieveSql = `SELECT * from service_providers sp
LEFT JOIN webhooks AS rh
ON sp.registration_hook_sid = rh.webhook_sid`;


function transmogrifyResults(results) {
  return results.map((row) => {
    const obj = row.sp;
    if (row.rh && Object.keys(row.rh).length && row.rh.url !== null) {
      Object.assign(obj, {registration_hook: row.rh});
      delete obj.registration_hook.webhook_sid;
    }
    else obj.registration_hook = null;
    delete obj.registration_hook_sid;
    return obj;
  });
}

class ServiceProvider extends Model {
  constructor() {
    super();
  }

  /**
   * list all service providers
   */
  static retrieveAll() {
    const sql = retrieveSql;
    return new Promise((resolve, reject) => {
      getMysqlConnection((err, conn) => {
        if (err) return reject(err);
        conn.query({sql, nestTables: true}, [], (err, results, fields) => {
          conn.release();
          if (err) return reject(err);
          const r = transmogrifyResults(results);
          resolve(r);
        });
      });
    });
  }

  /**
   * retrieve a service provider
   */
  static retrieve(sid) {
    const args = [sid];
    const sql = `${retrieveSql} WHERE sp.service_provider_sid = ?`;
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

ServiceProvider.table = 'service_providers';
ServiceProvider.fields = [
  {
    name: 'service_provider_sid',
    type: 'string',
    primaryKey: true
  },
  {
    name: 'name',
    type: 'string',
    required: true
  },
  {
    name: 'description',
    type: 'string'
  },
  {
    name: 'root_domain',
    type: 'string',
  },
  {
    name: 'registration_hook_sid',
    type: 'string',
  },
  {
    name: 'ms_teams_fqdn',
    type: 'string',
  }

];

module.exports = ServiceProvider;
