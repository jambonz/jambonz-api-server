const Model = require('./model');

class ApiKey extends Model {
  constructor() {
    super();
  }
}

ApiKey.table = 'api_keys';
ApiKey.fields = [
  {
    name: 'api_key_sid',
    type: 'string',
    primaryKey: true
  },
  {
    name: 'token',
    type: 'string',
    required: true
  },
  {
    name: 'account_sid',
    type: 'string'
  },
  {
    name: 'service_provider_sid',
    type: 'string'
  }
];

module.exports = ApiKey;
