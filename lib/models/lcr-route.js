const Model = require('./model');
const {promisePool} = require('../db');


class LcrRoutes extends Model {
  constructor() {
    super();
  }

  static async retrieveAllByLcrSid(sid) {
    const sql = `(SELECT * FROM ${this.table} WHERE lcr_sid = ?) ORDER BY priority`;
    const [rows] = await promisePool.query(sql, sid);
    return rows;
  }

  static async deleteByLcrSid(sid) {
    const sql = `DELETE FROM ${this.table} WHERE lcr_sid = ?`;
    const [rows] = await promisePool.query(sql, sid);
    return rows.affectedRows;
  }

  static async countAllByLcrSid(sid) {
    const sql = `SELECT COUNT(*) AS count FROM ${this.table} WHERE lcr_sid = ?`;
    const [rows] = await promisePool.query(sql, sid);
    return rows.length ? rows[0].count : 0;
  }

  static async retrieveAllByLcrSidPaginated(sid, limit, page) {
    const offset = (page - 1) * limit;

    const sql = `(SELECT * FROM ${this.table} WHERE lcr_sid = ? LIMIT ? OFFSET ? ) ORDER BY priority`;
    const [rows] = await promisePool.query(sql, [sid, limit, offset]);

    const countSql = `SELECT COUNT(*) AS total_items FROM ${this.table} WHERE lcr_sid = ?`;
    const [row] = await promisePool.query(countSql, [sid]);
    const [{ total_items = 0 }] = row;
    const total_pages = Math.ceil(total_items / limit) || 1;

    return {
      total_items,
      total_pages,
      page,
      data: rows,
    };
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
