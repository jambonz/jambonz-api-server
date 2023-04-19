const Model = require('./model');
const {promisePool, getMysqlConnection} = require('../db');


class LcrRoutes extends Model {
  constructor() {
    super();
  }

  static async retrieveAllByLcrSid(sid) {
    const sql = `SELECT * FROM ${this.table} WHERE lcr_sid = ?`;
    const [rows] = await promisePool.query(sql, sid);
    return rows;
  }

  static deleteByLcrSid(sid) {
    const args = [sid];
    const sql = `DELETE FROM ${this.table} WHERE lcr_sid = ?`;
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
