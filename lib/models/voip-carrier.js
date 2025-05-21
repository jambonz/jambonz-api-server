const Model = require('./model');
const {promisePool} = require('../db');
const retrieveSql = 'SELECT * from voip_carriers vc WHERE vc.account_sid = ?';
const retrieveSqlForSP = 'SELECT * from voip_carriers vc WHERE vc.service_provider_sid = ?';


class VoipCarrier extends Model {
  constructor() {
    super();
  }

  static _criteriaBuilder(obj, args) {
    let sql = '';
    if (obj.account_sid) {
      sql += ` AND ((vc.account_sid = ?) OR 
        (vc.account_sid IS NULL AND
        vc.service_provider_sid IN (SELECT service_provider_sid FROM accounts WHERE account_sid = ?)))`;
      args.push(obj.account_sid);
      args.push(obj.account_sid);
    } else {
      sql += ' AND vc.account_sid IS NULL';
    }
    if (obj.service_provider_sid) {
      sql += ' AND vc.service_provider_sid = ?';
      args.push(obj.service_provider_sid);
    }
    if (obj.name) {
      sql += ' AND vc.name LIKE ?';
      args.push(`%${obj.name}%`);
    }

    return sql;
  }

  static async countAll(obj) {
    let sql = 'SELECT COUNT(*) AS count FROM voip_carriers vc WHERE 1 = 1';
    const args = [];
    sql += VoipCarrier._criteriaBuilder(obj, args);
    const [rows] = await promisePool.query(sql, args);
    return rows[0].count;
  }

  static async retrieveByCriteria(obj) {
    let sql = 'SELECT * from voip_carriers vc WHERE 1 =1';
    const args = [];
    sql += VoipCarrier._criteriaBuilder(obj, args);
    if (obj.page !== null && obj.page !== undefined) {
      const limit = Number(obj.page_size || 50);
      const offset = (Number(obj.page) - 1) * limit;
      sql += ' LIMIT ? OFFSET ?';
      args.push(limit, offset);
    }
    const [rows] = await promisePool.query(sql, args);
    if (rows) {
      rows.map((r) => r.register_status = JSON.parse(r.register_status || '{}'));
    }
    return rows;
  }

  static async retrieveAll(account_sid) {
    if (!account_sid) return super.retrieveAll();
    const [rows] = await promisePool.query(retrieveSql, account_sid);
    if (rows) {
      rows.map((r) => r.register_status = JSON.parse(r.register_status || '{}'));
    }
    return rows;
  }
  static async retrieveAllForSP(service_provider_sid) {
    const [rows] = await promisePool.query(retrieveSqlForSP, service_provider_sid);
    if (rows) {
      rows.map((r) => r.register_status = JSON.parse(r.register_status || '{}'));
    }
    return rows;
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
    name: 'service_provider_sid',
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
    name: 'register_use_tls',
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
  },
  {
    name: 'smpp_system_id',
    type: 'string'
  },
  {
    name: 'smpp_password',
    type: 'string'
  },
  {
    name: 'smpp_inbound_system_id',
    type: 'string'
  },
  {
    name: 'smpp_inbound_password',
    type: 'string'
  },
  {
    name: 'smpp_enquire_link_interval',
    type: 'number'
  },
  {
    name: 'smpp_system_id',
    type: 'string'
  },
  {
    name: 'register_from_user',
    type: 'string'
  },
  {
    name: 'register_from_domain',
    type: 'string'
  },
  {
    name: 'register_public_ip_in_contact',
    type: 'number'
  },
  {
    name: 'register_status',
    type: 'string'
  },
  {
    name: 'dtmf_type',
    type: 'string'
  },
  {
    name: 'sip_proxy',
    type: 'string'
  }
];

module.exports = VoipCarrier;
