const Model = require('./model');
const {promisePool} = require('../db');
const retrieveSql = 'SELECT * from smpp_gateways WHERE voip_carrier_sid = ?';

class SmppGateway extends Model {
  constructor() {
    super();
  }
  /**
   * list all sip gateways for a voip_carrier
   */
  static async retrieveForVoipCarrier(voip_carrier_sid) {
    const [rows] = await promisePool.query(retrieveSql, voip_carrier_sid);
    return rows;
  }
}

SmppGateway.table = 'smpp_gateways';
SmppGateway.fields = [
  {
    name: 'smpp_gateway_sid',
    type: 'string',
    primaryKey: true
  },
  {
    name: 'voip_carrier_sid',
    type: 'string'
  },
  {
    name: 'ipv4',
    type: 'string',
    required: true
  },
  {
    name: 'port',
    type: 'number'
  },
  {
    name: 'netmask',
    type: 'number'
  },
  {
    name: 'inbound',
    type: 'number'
  },
  {
    name: 'outbound',
    type: 'number'
  },
  {
    name: 'is_primary',
    type: 'number'
  },
  {
    name: 'use_tls',
    type: 'number'
  }
];

module.exports = SmppGateway;
