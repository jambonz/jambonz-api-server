const test = require('tape') ;
const jwt = require('jsonwebtoken');
const ADMIN_TOKEN = '38700987-c7a4-4685-a5bb-af378f9734de';
const authAdmin = {bearer: ADMIN_TOKEN};
const request = require('request-promise-native').defaults({
  baseUrl: 'http://127.0.0.1:3000/v1'
});

test('system information test', async(t) => {
  const app = require('../app');
  try {
    let result = await request.post('/SystemInformation', {
      resolveWithFullResponse: true,
      auth: authAdmin,
      json: true,
      body: {
        domain_name: 'test.com',
        sip_domain_name: 'sip.test.com',
        monitoring_domain_name: 'monitor.test.com'
      }
    });
    t.ok(result.statusCode === 201, 'successfully created system information ');
    let body = result.body;
    t.ok(body.domain_name === 'test.com', 'added domain_name ok');
    t.ok(body.sip_domain_name === 'sip.test.com', 'added sip_domain_name ok');
    t.ok(body.monitoring_domain_name === 'monitor.test.com', 'added monitoring_domain_name ok');

    result = await request.get('/SystemInformation', {
      auth: authAdmin,
      json: true,
    });
    t.ok(result.domain_name === 'test.com', 'get domain_name ok');
    t.ok(result.sip_domain_name === 'sip.test.com', 'get sip_domain_name ok');
    t.ok(result.monitoring_domain_name === 'monitor.test.com', 'get monitoring_domain_name ok');

    result = await request.post('/SystemInformation', {
      resolveWithFullResponse: true,
      auth: authAdmin,
      json: true,
      body: {
        domain_name: 'test1.com',
        sip_domain_name: 'sip1.test.com',
        monitoring_domain_name: 'monitor1.test.com'
      }
    });
    t.ok(result.statusCode === 201, 'successfully updated system information ');
    body = result.body;
    t.ok(body.domain_name === 'test1.com', 'updated domain_name ok');
    t.ok(body.sip_domain_name === 'sip1.test.com', 'updated sip_domain_name ok');
    t.ok(body.monitoring_domain_name === 'monitor1.test.com', 'updated monitoring_domain_name ok');

    result = await request.get('/SystemInformation', {
      auth: authAdmin,
      json: true,
    });
    t.ok(result.domain_name === 'test1.com', 'get domain_name ok');
    t.ok(result.sip_domain_name === 'sip1.test.com', 'get sip_domain_name ok');
    t.ok(result.monitoring_domain_name === 'monitor1.test.com', 'get monitoring_domain_name ok');

  } catch(err) {
    console.error(err);
    t.end(err);
  }
});