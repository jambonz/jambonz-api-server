const Model = require('./model');
const {promisePool} = require('../db');
const retrieveSql = 'SELECT * from voip_carriers vc WHERE vc.account_sid = ?';
const retrieveSqlForSP = 'SELECT * from voip_carriers vc WHERE vc.service_provider_sid = ?';


class VoipCarrier extends Model {
  constructor() {
    super();
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
  }
];

module.exports = VoipCarrier;
