const Model = require('./model');
const {getMysqlConnection} = require('../db');

class LcrCarrierSetEntry extends Model {
  constructor() {
    super();
  }

  static retrieve(sid) {
    const args = [sid];
    const sql = `SELECT * FROM ${this.table} WHERE lcr_carrier_set_entry_sid = ?`;
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

  static retrieveAllByLcrRouteSid(sid) {
    const args = [sid];
    const sql = `SELECT * FROM ${this.table} WHERE lcr_route_sid = ?`;
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

  static deleteByLcrRouteSid(sid) {
    const args = [sid];
    const sql = `DELETE FROM ${this.table} WHERE lcr_route_sid = ?`;
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
}

LcrCarrierSetEntry.table = 'lcr_carrier_set_entry';
LcrCarrierSetEntry.fields = [
  {
    name: 'lcr_carier_set_entry_sid',
    type: 'string',
    primaryKey: true
  },
  {
    name: 'workload',
    type: 'number'
  },
  {
    name: 'lcr_route_sid',
    type: 'string'
  },
  {
    name: 'voip_carrier_sid',
    type: 'string'
  },
  {
    name: 'priority',
    type: 'number'
  }
];

module.exports = LcrCarrierSetEntry;
