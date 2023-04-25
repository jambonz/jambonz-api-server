const Model = require('./model');
const {promisePool} = require('../db');


class LcrRoutes extends Model {
  constructor() {
    super();
  }

  static async retrieveAllByLcrSid(sid) {
    const sql = `SELECT * FROM ${this.table} WHERE lcr_sid = ? ORDER BY priority`;
    const [rows] = await promisePool.query(sql, sid);
    return rows;
  }

  static async deleteByLcrSid(sid) {
    const sql = `DELETE FROM ${this.table} WHERE lcr_sid = ?`;
    const [rows] = await promisePool.query(sql, sid);
    return rows.affectedRows;
  }
}

LcrRoutes.table = 'lcr_routes';
LcrRoutes.fields = [
  {
    name: 'lcr_route_sid',
    type: 'string',
    primaryKey: true
  },
  {
    name: 'lcr_sid',
    type: 'string'
  },
  {
    name: 'regex',
    type: 'string'
  },
  {
    name: 'description',
    type: 'string'
  },
  {
    name: 'priority',
    type: 'number'
  }
];

module.exports = LcrRoutes;
