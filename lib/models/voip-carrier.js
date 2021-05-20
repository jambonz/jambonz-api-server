const Model = require('./model');
const {getMysqlConnection} = require('../db');
const sql = 'SELECT * from voip_carriers vc WHERE vc.account_sid = ?';


class VoipCarrier extends Model {
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
        conn.query(`${sql} AND vc.voip_carrier_sid = ?`, [account_sid, sid], (err, results, fields) => {
          conn.release();
          if (err) return reject(err);
          resolve(results);
        });
      });
    });
  }

}

VoipCarrier.table = 'voip_carriers';
VoipCarrier.fields = [
  {
    name: 'voip_carrier_sid',
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
    name: 'account_sid',
    type: 'string',
  },
  {
    name: 'application_sid',
    type: 'string'
  },
  {
    name: 'e164_leading_plus',
    type: 'number'
  },
  {
    name: 'requires_register',
    type: 'number'
  },
  {
    name: 'register_username',
    type: 'string'
  },
  {
    name: 'register_sip_realm',
    type: 'string'
  },
  {
    name: 'register_password',
    type: 'string'
  },
  {
    name: 'tech_prefix',
    type: 'string'
  },
  {
    name: 'inbound_auth_username',
    type: 'string'
  },
  {
    name: 'inbound_auth_password',
    type: 'string'
  },
  {
    name: 'diversion',
    type: 'string'
  },
  {
    name: 'is_active',
    type: 'number'
  }
];

module.exports = VoipCarrier;
