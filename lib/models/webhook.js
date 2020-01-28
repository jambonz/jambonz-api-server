const Model = require('./model');

class Webhook extends Model {
  constructor() {
    super();
  }
}

Webhook.table = 'webhooks';
Webhook.fields = [
  {
    name: 'webhook_sid',
    type: 'string',
    primaryKey: true
  },
  {
    name: 'url',
    type: 'string',
    required: true
  },
  {
    name: 'method',
    type: 'string'
  },
  {
    name: 'username',
    type: 'string'
  },
  {
    name: 'password',
    type: 'string'
  }
];

module.exports = Webhook;
