const Model = require('./model');

class SmppGateway extends Model {
  constructor() {
    super();
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
