const test = require('tape') ;
const ADMIN_TOKEN = '38700987-c7a4-4685-a5bb-af378f9734de';
const authAdmin = {bearer: ADMIN_TOKEN};
const request = require('request-promise-native').defaults({
  baseUrl: 'http://127.0.0.1:3000/v1'
});


process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
});

test('client test', async(t) => {
  const app = require('../app');
  const {registrar} = app.locals;

  try {
    let result;
    /* add a service provider */
    result = await request.post('/ServiceProviders', {
      resolveWithFullResponse: true,
      auth: authAdmin,
      json: true,
      body: {
        name: 'client_sp',
      }
    });
    t.ok(result.statusCode === 201, 'successfully created client service provider');
    const sp_sid = result.body.sid;

    /* add an account */
    result = await request.post('/Accounts', {
      resolveWithFullResponse: true,
      auth: authAdmin,
      json: true,
      body: {
        name: 'sample_account',
        service_provider_sid: sp_sid,
        sip_realm: 'drachtio.org',
        registration_hook: {
          url: 'http://example.com/reg',
          method: 'get'
        },
        webhook_secret: 'foobar'
      }
    });
    t.ok(result.statusCode === 201, 'successfully created account');
    const account_sid = result.body.sid;

    /* add new entity */
    result = await request.post('/Clients', {
      resolveWithFullResponse: true,
      auth: authAdmin,
      json: true,
      body: {
        account_sid,
        username: 'client1',
        password: 'sdf12412',
        is_active: 1
      }
    });
    t.ok(result.statusCode === 201, 'successfully created Client');
    const sid = result.body.sid;

    /* register the client */
    const r = await registrar.add(
      "dhorton@drachtio.org",
      {
        contact: "10.10.1.1",
        sbcAddress: "192.168.1.1",
        protocol: "udp",
      },
      5
    );
    t.ok(r, 'successfully registered Client');

    /* query all registered clients */
    result = await request.get(`/Accounts/${account_sid}/RegisteredSipUsers`, {
      auth: authAdmin,
      json: true,
    });
    t.ok(result.length === 1 && result[0] === 'dhorton@drachtio.org', 
      'successfully queried all registered clients');

    /* query all entity */
    result = await request.get('/Clients', {
      auth: authAdmin,
      json: true,
    });
    t.ok(result.length === 1 , 'successfully queried all Clients');

    /* query one entity */
    result = await request.get(`/Clients/${sid}`, {
      auth: authAdmin,
      json: true,
    });
    t.ok(result.account_sid === account_sid , 'successfully retrieved Client by sid');
    t.ok(result.client_sid, 'successfully retrieved Client by sid');
    t.ok(result.username ===  'client1', 'successfully retrieved Client by sid');
    t.ok(result.is_active === 1 , 'successfully retrieved Client by sid');
    t.ok(result.password === 'sXXXXXXX' , 'successfully retrieved Client by sid');

    /* update the entity */
    result = await request.put(`/Clients/${sid}`, {
      auth: authAdmin,
      json: true,
      resolveWithFullResponse: true,
      body: {
        is_active: 0
      }
    });
    t.ok(result.statusCode === 204, 'successfully updated Client');
    /* query one entity */
    result = await request.get(`/Clients/${sid}`, {
      auth: authAdmin,
      json: true,
    });
    t.ok(result.is_active === 0 , 'successfully updated Client');
    t.ok(result.password === 'sXXXXXXX' , 'successfully retrieved Client by sid');

    /* delete Client */
    result = await request.delete(`/Clients/${sid}`, {
      resolveWithFullResponse: true,
      simple: false,
      json: true,
      auth: authAdmin
    });
    t.ok(result.statusCode === 204, 'successfully deleted Clients');

    /* query all entity */
    result = await request.get('/Clients', {
      auth: authAdmin,
      json: true,
    });
    t.ok(result.length === 0 , 'successfully queried all Clients');
    
  } catch (err) {
    console.error(err);
    t.end(err);
  }
})