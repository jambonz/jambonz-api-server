const Model = require('./model');

class ServiceProvider extends Model {
  constructor() {
    super();
  }
}

ServiceProvider.table = 'service_providers';
ServiceProvider.fields = [
  {
    name: 'service_provider_sid',
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

module.exports = ServiceProvider;
