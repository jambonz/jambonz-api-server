const Model = require('./model');
const {getMysqlConnection} = require('../db');
const sql = 'SELECT * from phone_numbers WHERE account_sid = ?';

class PhoneNumber extends Model {
  constructor() {
    super();
  }

  static retrieveAll(account_sid) {
    if (!account_sid) return super.retrieveAll();

    return new Promise((resolve, reject) => {
      getMysqlConnection((err, conn) => {
        if (err) return reject(err);
        conn.query(sql, account_sid, (err, results, fields) => {
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
  static retrieve(sid, account_sid) {
    if (!account_sid) return super.retrieve(sid);

    return new Promise((resolve, reject) => {
      getMysqlConnection((err, conn) => {
        if (err) return reject(err);
        conn.query(`${sql} AND phone_number_sid = ?`, [account_sid, sid], (err, results, fields) => {
          conn.release();
          if (err) return reject(err);
          resolve(results);
        });
      });
    });
  }

}

PhoneNumber.table = 'phone_numbers';
PhoneNumber.fields = [
  {
    name: 'phone_number_sid',
    type: 'string',
    primaryKey: true
  },
  {
    name: 'number',
    type: 'string',
    required: true
  },
  {
    name: 'voip_carrier_sid',
    type: 'string'
  },
  {
    name: 'account_sid',
    type: 'string',
  },
  {
    name: 'application_sid',
    type: 'string',
  }
];

module.exports = PhoneNumber;
