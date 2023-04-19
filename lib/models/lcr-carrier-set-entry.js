const Model = require('./model');
const {promisePool, getMysqlConnection} = require('../db');

class LcrCarrierSetEntry extends Model {
  constructor() {
    super();
  }

  static async retrieveAllByLcrRouteSid(sid) {
    const sql = `SELECT * FROM ${this.table} WHERE lcr_route_sid = ?`;
    const [rows] = await promisePool.query(sql, sid);
    return rows;
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
          resolve(results.affectedRows);
        });
      });
    });
  }
}

LcrCarrierSetEntry.table = 'lcr_carrier_set_entry';
LcrCarrierSetEntry.fields = [
  {
    name: 'lcr_carrier_set_entry_sid',
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
