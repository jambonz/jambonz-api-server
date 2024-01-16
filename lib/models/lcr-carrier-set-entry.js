const Model = require('./model');
const {promisePool} = require('../db');

class LcrCarrierSetEntry extends Model {
  constructor() {
    super();
  }

  static async retrieveAllByLcrRouteSid(sid) {
    const sql = `(SELECT * FROM ${this.table} WHERE lcr_route_sid = ?) ORDER BY priority`;
    const [rows] = await promisePool.query(sql, sid);
    return rows;
  }

  static async deleteByLcrRouteSid(sid) {
    const sql = `DELETE FROM ${this.table} WHERE lcr_route_sid = ?`;
    const [rows] = await promisePool.query(sql, sid);
    return rows.affectedRows;
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
