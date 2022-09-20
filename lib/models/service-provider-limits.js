const Model = require('./model');

class ServiceProviderLimits extends Model {
  constructor() {
    super();
  }
}

ServiceProviderLimits.table = 'service_provider_limits';
ServiceProviderLimits.fields = [
  {
    name: 'service_provider_limits_sid',
    type: 'string',
    primaryKey: true
  },
  {
    name: 'service_provider_sid',
    type: 'string',
    required: true
  },
  {
    name: 'category',
    type: 'string',
    required: true
  },
  {
    name: 'quantity',
    type: 'number',
    required: true
  }
];

module.exports = ServiceProviderLimits;
