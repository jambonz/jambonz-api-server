const Model = require('./model');

class PredefinedCarrier extends Model {
  constructor() {
    super();
  }
}

PredefinedCarrier.table = 'predefined_carriers';
PredefinedCarrier.fields = [
  {
    name: 'predefined_carrier_sid',
    type: 'string',
    primaryKey: true
  },
  {
    name: 'name',
    type: 'string',
    required: true
  },
  {
    name: 'requires_static_ip',
    type: 'number'
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
];

module.exports = PredefinedCarrier;
