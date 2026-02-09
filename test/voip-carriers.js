const test = require('tape') ;
const ADMIN_TOKEN = '38700987-c7a4-4685-a5bb-af378f9734de';
const authAdmin = {bearer: ADMIN_TOKEN};
const { createClient } = require('./http-client');
const request = createClient({
  baseUrl: 'http://127.0.0.1:3000/v1'
});
const {createServiceProvider, createAccount, createApplication, deleteObjectBySid} = require('./utils');


process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
});

test('voip carrier tests', async(t) => {
  const app = require('../app');
  let sid;
  try {
    let result;
    const outbound_sip_proxy = 'foo.bar.com';

    /* add a voip carrier */
    result = await request.post('/VoipCarriers', {
      resolveWithFullResponse: true,
      auth: authAdmin,
      json: true,
      body: {
        name: 'daveh',
        e164_leading_plus: true,
        outbound_sip_proxy,
      }
    });
    t.ok(result.statusCode === 201, 'successfully created voip carrier');
    sid = result.body.sid;

    /* query all voip carriers */
    result = await request.get('/VoipCarriers', {
      auth: authAdmin,
      json: true,
    });
    t.ok(result.length === 1 && result[0].e164_leading_plus, 'successfully queried all voip carriers');
    t.ok(result.length === 1 && result[0].outbound_sip_proxy === outbound_sip_proxy, 'successfully queried all voip carriers');

    /* query one voip carriers */
    result = await request.get(`/VoipCarriers/${sid}`, {
      auth: authAdmin,
      json: true,
    });
    t.ok(result.name === 'daveh' , 'successfully retrieved voip carrier by sid');

    /* fail to query one voip carriers with invalid uuid */
    try {
      result = await request.get(`/VoipCarriers/123`, {
        auth: authAdmin,
        json: true,
      });
    } catch (err) {
      t.ok(err.statusCode === 400, 'returns 400 bad request if voip carrier sid param is not a valid uuid');
    }

    /* update voip carriers */
    result = await request.put(`/VoipCarriers/${sid}`, {
      auth: authAdmin,
      json: true,
      resolveWithFullResponse: true,
      body: {
        name: 'robb',
        requires_register: true,
        register_username: 'foo',
        register_sip_realm: 'sip.bar.com',
        register_password: 'baz',
        register_from_user: 'fromme',
        register_from_domain: 'from.domain.com'
      }
    });
    t.ok(result.statusCode === 204, 'successfully updated voip carrier');

    /* provision a phone number for the voip carrier */
    result = await request.post('/PhoneNumbers', {
      resolveWithFullResponse: true,
      simple: false,
      auth: authAdmin,
      json: true,
      body: {
        number: '15083084809',
        voip_carrier_sid: sid
      }
    });
    t.ok(result.statusCode === 201, 'successfully provisioned a phone number from voip carrier');
    const phone_number_sid = result.body.sid;


    /* can't delete a voip carrier that has phone numbers assigned */
    result = await request.delete(`/VoipCarriers/${sid}`, {
      resolveWithFullResponse: true,
      simple: false,
      json: true,
      auth: authAdmin
    });
    //console.log(`result: ${JSON.stringify(result)}`);
    t.ok(result.statusCode === 422 && result.body.msg === 'cannot delete voip carrier with active phone numbers',
      'cannot delete voip carrier with active phone numbers');

    /* delete phone number */
    result = await request.delete(`/PhoneNumbers/${phone_number_sid}`, {
      resolveWithFullResponse: true,
      simple: false,
      json: true,
      auth: authAdmin
    });
    //console.log(`result: ${JSON.stringify(result)}`);
    t.ok(result.statusCode === 204, 'successfully deleted phone number');

    /* delete voip carrier */
    result = await request.delete(`/VoipCarriers/${sid}`, {
      resolveWithFullResponse: true,
      simple: false,
      json: true,
      auth: authAdmin
    });
    //console.log(`result: ${JSON.stringify(result)}`);
    t.ok(result.statusCode === 204, 'successfully deleted voip carrier');
    
    /* create voip carrier that is a customer PBX */
    const service_provider_sid = await createServiceProvider(request);
    const account_sid = await createAccount(request, service_provider_sid);
    const account_sid2 = await createAccount(request, service_provider_sid, 'another');
    const application_sid = await createApplication(request, account_sid);
    
    result = await request.post('/VoipCarriers', {
      resolveWithFullResponse: true,
      simple: false,
      auth: authAdmin,
      json: true,
      body: {
        name: 'daveh',
        account_sid: 'xxxx'
      }
    });
    t.ok(result.statusCode === 400 && result.body.msg === 'unknown account_sid', 'fails to create voip_carrier with unknown account_sid');

    result = await request.post('/VoipCarriers', {
      resolveWithFullResponse: true,
      simple: false,
      auth: authAdmin,
      json: true,
      body: {
        name: 'daveh',
        application_sid
      }
    });
    t.ok(result.statusCode === 400 && result.body.msg === 'account_sid missing', 'fails to create voip_carrier with missing account_sid');

    result = await request.post('/VoipCarriers', {
      resolveWithFullResponse: true,
      simple: false,
      auth: authAdmin,
      json: true,
      body: {
        name: 'daveh',
        account_sid: account_sid2,
        application_sid
      }
    });
    t.ok(result.statusCode === 400 && result.body.msg === 'application_sid does not exist for specified account_sid', 
      'fails to create voip_carrier with account_sid not matching application_sid');

      result = await request.post('/VoipCarriers', {
        resolveWithFullResponse: true,
        simple: false,
        auth: authAdmin,
        json: true,
        body: {
          name: 'daveh',
          account_sid: account_sid,
          application_sid: 'xxx'
        }
      });
      t.ok(result.statusCode === 400 && result.body.msg === 'unknown application_sid', 'fails to create voip_carrier with unknown application_sid');
  
      result = await request.post('/VoipCarriers', {
      resolveWithFullResponse: true,
      auth: authAdmin,
      json: true,
      body: {
        name: 'daveh',
        account_sid,
        application_sid
      }
    });
    t.ok(result.statusCode === 201, 'successfully created customer PBX with account and application');
    sid = result.body.sid;
    await deleteObjectBySid(request, '/VoipCarriers', sid);

    result = await request.post('/VoipCarriers', {
      resolveWithFullResponse: true,
      auth: authAdmin,
      json: true,
      body: {
        name: 'daveh',
        account_sid
      }
    });
    t.ok(result.statusCode === 201, 'successfully created customer PBX with account only');
    sid = result.body.sid;
    await deleteObjectBySid(request, '/VoipCarriers', sid);

    /* add a voip carrier for a service provider */
    result = await request.post(`/ServiceProviders/${service_provider_sid}/VoipCarriers`, {
      resolveWithFullResponse: true,
      auth: authAdmin,
      json: true,
      body: {
        name: 'twilio',
        e164_leading_plus: true,
        dtmf_type: 'tones'
      }
    });
    t.ok(result.statusCode === 201, 'successfully created voip carrier for a service provider');
    sid = result.body.sid;

    /* list voip carriers for a service provider */
    result = await request.get(`/ServiceProviders/${service_provider_sid}/VoipCarriers`, {
      resolveWithFullResponse: true,
      auth: authAdmin,
      json: true,
    });
    //console.log(result.body);
    t.ok(result.statusCode === 200, 'successfully retrieved voip carrier for a service provider');
    //console.log(result.body);
    sid = result.body[0].voip_carrier_sid;
  
    await deleteObjectBySid(request, '/VoipCarriers', sid);
    await deleteObjectBySid(request, '/Applications', application_sid);
    await deleteObjectBySid(request, '/Accounts', account_sid);
    await deleteObjectBySid(request, '/Accounts', account_sid2);
    await deleteObjectBySid(request, '/ServiceProviders', service_provider_sid);

    //t.end();
  }
  catch (err) {
    console.error(err);
    t.end(err);
  }
});

test('voip carrier registration field validation', async(t) => {
  const app = require('../app');
  let sid;
  try {
    let result;

    /* Test: register_username required when requires_register is true */
    result = await request.post('/VoipCarriers', {
      resolveWithFullResponse: true,
      simple: false,
      auth: authAdmin,
      json: true,
      body: {
        name: 'test carrier',
        requires_register: true,
        register_password: 'password123',
        register_sip_realm: 'sip.example.com'
      }
    });
    t.ok(result.statusCode === 400 && result.body.msg.includes('register_username is required'),
      'returns 400 if requires_register=true but no register_username');

    /* Test: register_password required when requires_register is true */
    result = await request.post('/VoipCarriers', {
      resolveWithFullResponse: true,
      simple: false,
      auth: authAdmin,
      json: true,
      body: {
        name: 'test carrier',
        requires_register: true,
        register_username: 'testuser',
        register_sip_realm: 'sip.example.com'
      }
    });
    t.ok(result.statusCode === 400 && result.body.msg.includes('register_password is required'),
      'returns 400 if requires_register=true but no register_password');

    /* Test: register_username must not contain whitespace */
    result = await request.post('/VoipCarriers', {
      resolveWithFullResponse: true,
      simple: false,
      auth: authAdmin,
      json: true,
      body: {
        name: 'test carrier',
        requires_register: true,
        register_username: 'my trunk',
        register_password: 'password123'
      }
    });
    t.ok(result.statusCode === 400 && result.body.msg.includes('must not contain whitespace'),
      'returns 400 if register_username contains spaces');

    /* Test: register_sip_realm must not have sip: prefix */
    result = await request.post('/VoipCarriers', {
      resolveWithFullResponse: true,
      simple: false,
      auth: authAdmin,
      json: true,
      body: {
        name: 'test carrier',
        requires_register: true,
        register_username: 'user',
        register_password: 'pass',
        register_sip_realm: 'sip:example.com'
      }
    });
    t.ok(result.statusCode === 400 && result.body.msg.includes('no sip: prefix'),
      'returns 400 if register_sip_realm starts with sip:');

    /* Test: register_sip_realm must be valid domain format (contain a dot) */
    result = await request.post('/VoipCarriers', {
      resolveWithFullResponse: true,
      simple: false,
      auth: authAdmin,
      json: true,
      body: {
        name: 'test carrier',
        requires_register: true,
        register_username: 'user',
        register_password: 'pass',
        register_sip_realm: 'Switch'
      }
    });
    t.ok(result.statusCode === 400 && result.body.msg.includes('valid domain or IP'),
      'returns 400 if register_sip_realm is not a valid domain');

    /* Test: register_sip_realm must not be empty string */
    result = await request.post('/VoipCarriers', {
      resolveWithFullResponse: true,
      simple: false,
      auth: authAdmin,
      json: true,
      body: {
        name: 'test carrier',
        requires_register: true,
        register_username: 'user',
        register_password: 'pass',
        register_sip_realm: ''
      }
    });
    t.ok(result.statusCode === 400 && result.body.msg.includes('must not be empty string'),
      'returns 400 if register_sip_realm is empty string');

    /* Test: register_sip_realm can be null (falls back to gateway IP) */
    result = await request.post('/VoipCarriers', {
      resolveWithFullResponse: true,
      auth: authAdmin,
      json: true,
      body: {
        name: 'test carrier null realm',
        requires_register: true,
        register_username: 'user',
        register_password: 'pass',
        register_sip_realm: null
      }
    });
    t.ok(result.statusCode === 201, 'succeeds if register_sip_realm is null');
    sid = result.body.sid;
    await deleteObjectBySid(request, '/VoipCarriers', sid);

    /* Test: Valid IPv4 address is accepted as register_sip_realm */
    result = await request.post('/VoipCarriers', {
      resolveWithFullResponse: true,
      auth: authAdmin,
      json: true,
      body: {
        name: 'test carrier ipv4',
        requires_register: true,
        register_username: 'user',
        register_password: 'pass',
        register_sip_realm: '192.168.1.100'
      }
    });
    t.ok(result.statusCode === 201, 'succeeds if register_sip_realm is valid IPv4');
    sid = result.body.sid;
    await deleteObjectBySid(request, '/VoipCarriers', sid);

    /* Test: Valid domain is accepted as register_sip_realm */
    result = await request.post('/VoipCarriers', {
      resolveWithFullResponse: true,
      auth: authAdmin,
      json: true,
      body: {
        name: 'test carrier domain',
        requires_register: true,
        register_username: 'user',
        register_password: 'pass',
        register_sip_realm: 'sip.example.com'
      }
    });
    t.ok(result.statusCode === 201, 'succeeds if register_sip_realm is valid domain');
    sid = result.body.sid;

    /* Test: Update to enable requires_register without credentials fails */
    const sid2Result = await request.post('/VoipCarriers', {
      resolveWithFullResponse: true,
      auth: authAdmin,
      json: true,
      body: {
        name: 'test carrier no reg'
      }
    });
    const sid2 = sid2Result.body.sid;

    result = await request.put(`/VoipCarriers/${sid2}`, {
      resolveWithFullResponse: true,
      simple: false,
      auth: authAdmin,
      json: true,
      body: {
        requires_register: true
      }
    });
    t.ok(result.statusCode === 400 && result.body.msg.includes('register_username is required'),
      'returns 400 when enabling requires_register without credentials');

    await deleteObjectBySid(request, '/VoipCarriers', sid);
    await deleteObjectBySid(request, '/VoipCarriers', sid2);

  } catch (err) {
    console.error(err);
    t.end(err);
  }
});

