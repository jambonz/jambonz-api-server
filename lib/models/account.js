const Model = require('./model');

class Account extends Model {
  constructor() {
    super();
  }
}

Account.table = 'accounts';
Account.fields = [
  {
    name: 'account_sid',
    type: 'string',
    primaryKey: true
  },
  {
    name: 'name',
    type: 'string',
    required: true
  },
  {
    name: 'service_provider_sid',
    type: 'string',
    required: true
  },
  {
    name: 'sip_realm',
    type: 'string',
  },
  {
    name: 'registration_hook',
    type: 'string',
  }
];

module.exports = Account;
