const test = require('tape') ;
const ADMIN_TOKEN = '38700987-c7a4-4685-a5bb-af378f9734de';
const authAdmin = {bearer: ADMIN_TOKEN};
const request = require('request-promise-native').defaults({
  baseUrl: 'http://127.0.0.1:3000/v1'
});
const {
  createVoipCarrier, 
  createServiceProvider, 
  createPhoneNumber, 
  deleteObjectBySid} = require('./utils');

process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
});

test('account tests', async(t) => {
  const app = require('../app');
  const {pushBack} = app.locals;
  let sid;
  try {
    let result;

    /* add service provider, phone number, and voip carrier */
    const voip_carrier_sid = await createVoipCarrier(request);
    const service_provider_sid = await createServiceProvider(request);
    const phone_number_sid = await createPhoneNumber(request, voip_carrier_sid);
    
    /* add an account */
    result = await request.post('/Accounts', {
      resolveWithFullResponse: true,
      auth: authAdmin,
      json: true,
      body: {
        name: 'daveh',
        service_provider_sid,
        registration_hook: {
          url: 'http://example.com/reg',
          method: 'get'
        },
        queue_event_hook: {
          url: 'http://example.com/q',
          method: 'post'
        }
      }
    });
    t.ok(result.statusCode === 201, 'successfully created account');
    const sid = result.body.sid;

    /* add an account level api key */
    result = await request.post(`/ApiKeys`, {
      auth: authAdmin,
      json: true,
      resolveWithFullResponse: true,
      body: {
        account_sid: sid
      }
    });
    t.ok(result.statusCode === 201 && result.body.token, 'successfully created account level token');
    const apiKeySid = result.body.sid;
    const accountLevelToken = result.body.token;
  
    /* query all account level api keys */
    result = await request.get(`/Accounts/${sid}/ApiKeys`, {
      auth: {bearer: accountLevelToken},
      json: true,
    });
    t.ok(Array.isArray(result) && result.length === 1, 'successfully queried account level keys');

    /* query all accounts */
    result = await request.get('/Accounts', {
      auth: authAdmin,
      json: true,
    });
    let regHook = result[0].registration_hook;
    let qHook = result[0].queue_event_hook;
    t.ok(result.length === 1 &&
      Object.keys(regHook).length == 4 && Object.keys(qHook).length == 4, 'successfully queried all accounts');
    
    /* query one accounts */
    result = await request.get(`/Accounts/${sid}`, {
      auth: authAdmin,
      json: true,
    });
    t.ok(result.name === 'daveh' , 'successfully retrieved account by sid');

    /* update account with account level token */
    result = await request.put(`/Accounts/${sid}`, {
      auth: {bearer: accountLevelToken},
      json: true,
      resolveWithFullResponse: true,
      body: {
        name: 'robb',
        registration_hook: {
          url: 'http://example.com/reg2',
          method: 'get'
        }
      }
    });
    t.ok(result.statusCode === 204, 'successfully updated account using account level token');

    /* verify that account level api key last_used was updated*/
    result = await request.get(`/Accounts/${sid}/ApiKeys`, {
      auth: {bearer: accountLevelToken},
      json: true,
    });
    t.ok(typeof result[0].last_used === 'string', 'api_key last_used timestamp was updated');
    
    result = await request.get(`/Accounts/${sid}`, {
      auth: authAdmin,
      json: true,
    });
    t.ok(Object.keys(result.registration_hook).length === 4, 'successfully removed a hook from account');

    /* assign phone number to account */
    result = await request.put(`/PhoneNumbers/${phone_number_sid}`, {
      auth: authAdmin,
      json: true,
      resolveWithFullResponse: true,
      body: {
        account_sid: sid
      }
    });
    t.ok(result.statusCode === 204, 'successfully assigned phone number to account');

    /* retrieve queues for account */
    result = await request.get(`/Accounts/${sid}/Queues`, {
      auth: {bearer: accountLevelToken},
      json: true,
      resolveWithFullResponse: true,
    });
    t.ok(result.statusCode === 200 && 0 === result.body.length,
      'successfully retrieved an empty array when no queues exist');

      await pushBack(`queue:${sid}:customer-support`, 'https://ip:300/v1/enqueue/foobar');
      await pushBack(`queue:${sid}:customer-support`, 'https://ip:300/v1/enqueue/bazzle');
      await pushBack(`queue:${sid}:sales-new-orders`, 'https://ip:300/v1/enqueue/bazzle');
      await pushBack(`queue:${sid}:sales-returns`, 'https://ip:300/v1/enqueue/bazzle');

    result = await request.get(`/Accounts/${sid}/Queues`, {
      auth: {bearer: accountLevelToken},
      json: true,
      resolveWithFullResponse: true,
    });
    console.log(`retrieved queues: ${result.statusCode}: ${JSON.stringify(result.body)}`);
    //t.ok(result.statusCode === 200 && 0 === result.body.length,
    //  'successfully retrieved an empty array when no queues exist');

    result = await request.get(`/Accounts/${sid}/Queues?name=sales-*`, {
      auth: {bearer: accountLevelToken},
      json: true,
      resolveWithFullResponse: true,
    });
    console.log(`retrieved queues: ${result.statusCode}: ${JSON.stringify(result.body)}`);

    /* cannot delete account that has phone numbers assigned */
    result = await request.delete(`/Accounts/${sid}`, {
      auth: authAdmin,
      resolveWithFullResponse: true,
      simple: false,
      json: true
    });
    t.ok(result.statusCode === 422 && result.body.msg === 'cannot delete account with phone numbers', 'cannot delete account with phone numbers');

    /* delete account */
    await request.delete(`ApiKeys/${apiKeySid}`, {auth: {bearer: accountLevelToken}});
    await request.delete(`/PhoneNumbers/${phone_number_sid}`, {auth: authAdmin});
    result = await request.delete(`/Accounts/${sid}`, {
      auth: authAdmin,
      resolveWithFullResponse: true,
    });
    t.ok(result.statusCode === 204, 'successfully deleted account after removing phone number');

    await deleteObjectBySid(request, '/VoipCarriers', voip_carrier_sid);
    await deleteObjectBySid(request, '/ServiceProviders', service_provider_sid);
    //t.end();
  }
  catch (err) {
    console.error(err);
    t.end(err);
  }
});

