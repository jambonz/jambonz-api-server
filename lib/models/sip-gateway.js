const Model = require('./model');
const {promisePool} = require('../db');
const retrieveSql = 'SELECT * from sip_gateways WHERE voip_carrier_sid = ?';

class SipGateway extends Model {
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

SipGateway.table = 'sip_gateways';
SipGateway.fields = [
  {
    name: 'sip_gateway_sid',
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
    name: 'is_active',
    type: 'number'
  },
  {
    name: 'account_sid',
    type: 'string'
  },
  {
    name: 'application_sid',
    type: 'string'
  }
];

module.exports = SipGateway;
