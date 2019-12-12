const Model = require('./model');

class SipGateway extends Model {
  constructor() {
    super();
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
  }
];

module.exports = SipGateway;
