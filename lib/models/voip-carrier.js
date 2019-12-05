const Model = require('./model');

class VoipCarrier extends Model {
  constructor() {
    super();
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
  }
];

module.exports = VoipCarrier;
