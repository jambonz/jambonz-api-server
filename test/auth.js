const test = require('tape').test ;
const ADMIN_TOKEN = '38700987-c7a4-4685-a5bb-af378f9734de';
const authAdmin = {bearer: ADMIN_TOKEN};
const request = require('request-promise-native').defaults({
  baseUrl: 'http://127.0.0.1:3000/v1'
});
const {createVoipCarrier, createServiceProvider, createPhoneNumber, createAccount, deleteObjectBySid} = require('./utils');

process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
});

test('authentication tests', async(t) => {
  const app = require('../app');
  try {
    let result;

    /* create two service providers */
    const spA_sid = await createServiceProvider(request, 'spA');
    const spB_sid = await createServiceProvider(request, 'spB');
    const voip_carrier_sid = await createVoipCarrier(request);

    /* create a service provider token for each sp */
    result = await request.post('/ApiKeys', {
      resolveWithFullResponse: true,
      simple: false,
      auth: authAdmin,
      json: true,
      body: {
        service_provider_sid: spA_sid
      }
    });
    t.ok(result.statusCode === 201 && result.body.token, 'successfully created auth token for service provider A');
    const spA_token_sid = result.body.sid;
    const spA_token = result.body.token;

    result = await request.post('/ApiKeys', {
      resolveWithFullResponse: true,
      simple: false,
      auth: authAdmin,
      json: true,
      body: {
        service_provider_sid: spB_sid
      }
    });
    //console.log(`result: ${JSON.stringify(result)}`);
    t.ok(result.statusCode === 201 && result.body.token, 'successfully created auth token for service provider B');
    const spB_token_sid = result.body.sid;
    const spB_token = result.body.token;

    /* use service provider tokens to create two accounts for each SP */
    result = await request.post('/Accounts', {
      auth: {bearer: spA_token},
      resolveWithFullResponse: true,
      simple: false,
      json: true,
      body: {
        name: 'accountA1'
      }
    });
    t.ok(result.statusCode === 201, 'successfully created account A1 using service provider token A');
    const accA1 = result.body.sid;
    result = await request.post('/Accounts', {
      auth: {bearer: spA_token},
      resolveWithFullResponse: true,
      simple: false,
      json: true,
      body: {
        name: 'accountA2'
      }
    });
    t.ok(result.statusCode === 201, 'successfully created account A2 using service provider token A');
    const accA2 = result.body.sid;
    result = await request.post('/Accounts', {
      auth: {bearer: spB_token},
      resolveWithFullResponse: true,
      simple: false,
      json: true,
      body: {
        name: 'accountB1'
      }
    });
    t.ok(result.statusCode === 201, 'successfully created account B1 using service provider token B');
    const accB1 = result.body.sid;
    result = await request.post('/Accounts', {
      auth: {bearer: spB_token},
      resolveWithFullResponse: true,
      simple: false,
      json: true,
      body: {
        name: 'accountB2'
      }
    });
    t.ok(result.statusCode === 201, 'successfully created account B2 using service provider token B');
    const accB2 = result.body.sid;

    /* using auth token we see two accounts */
    result = await request.get('/Accounts', {
      auth: authAdmin,
      json: true
    });
    //console.log(`result: ${JSON.stringify(result)}`);
    t.ok(result.length === 4, 'using admin token we see all accounts');

    /* using service provider token we see one account */
    result = await request.get('/Accounts', {
      auth: {bearer: spA_token},
      json: true
    });
    //console.log(`result: ${JSON.stringify(result)}`);
    t.ok(result.length === 2, 'using service provider token we see all accounts');

    /* cannot update account from different service provider */
    result = await request.put(`/Accounts/${accA1}`, {
      auth: {bearer: spB_token},
      resolveWithFullResponse: true,
      simple: false,
      json: true,
      body: {
        sip_realm: 'sip.foo.bar'
      }
    });
    t.ok(result.statusCode === 422 && result.body.msg === 'cannot update account from different service provider',
      'service provider token B cannot be used to update account from service provider A');

    /* cannot delete account from different service provider */
    result = await request.delete(`/Accounts/${accA1}`, {
      auth: {bearer: spB_token},
      resolveWithFullResponse: true,
      simple: false,
      json: true,
    });
    t.ok(result.statusCode === 422 && result.body.msg === 'cannot delete account from different service provider',
      'service provider token B cannot be used to delete account from service provider A');

    /* service provider token A can update account A1 */
    result = await request.put(`/Accounts/${accA1}`, {
      auth: {bearer: spA_token},
      resolveWithFullResponse: true,
      simple: false,
      json: true,
      body: {
        sip_realm: 'sip.foo.bar'
      }
    });
    t.ok(result.statusCode === 204, 'service provider token A can update account A1');

    /* create a account token for account A1 */
    result = await request.post('/ApiKeys', {
      resolveWithFullResponse: true,
      simple: false,
      auth: {bearer: spA_token},
      json: true,
      body: {
        account_sid: accA1
      }
    });
    t.ok(result.statusCode === 201 && result.body.token, 'successfully created auth token for account A1');
    const accA1_token_sid = result.body.sid;
    const accA1_token = result.body.token;

    /* cannot create an account using an account-level token */
    result = await request.post('/Accounts', {
      auth: {bearer: accA1_token},
      resolveWithFullResponse: true,
      simple: false,
      json: true,
      body: {
        name: 'accountC',
        service_provider_sid: spA_sid
      }
    });
    //console.log(`result: ${JSON.stringify(result)}`);
    t.ok(result.statusCode === 422 && result.body.msg === 'insufficient permissions to create accounts',
      'cannot create an account using an account-level token');

    /* using account token we see one account */
    result = await request.get('/Accounts', {
      auth: {bearer: accA1_token},
      json: true
    });
    //console.log(`result: ${JSON.stringify(result)}`);
    t.ok(result.length === 1, 'using account token we see one account');

    /* cannot update account A2 using auth token for account A1*/
    result = await request.put(`/Accounts/${accA2}`, {
      auth: {bearer: accA1_token},
      resolveWithFullResponse: true,
      simple: false,
      json: true,
      body: {
        sip_realm: 'sip.foo.bar'
      }
    });
    //console.log(`result: ${JSON.stringify(result)}`);
    t.ok(result.statusCode === 422 && result.body.msg === 'insufficient privileges to update this account',
      'cannot update account A2 using auth token for account A1');

    /* can update an account using an appropriate account-level token */
    result = await request.put(`/Accounts/${accA1}`, {
      auth: {bearer: accA1_token},
      resolveWithFullResponse: true,
      simple: false,
      json: true,
      body: {
        sip_realm: 'sip.foo.bar'
      }
    });
    //console.log(`result: ${JSON.stringify(result)}`);
    t.ok(result.statusCode === 204, 'successfully updated account A1 using auth token for account A1');

    /* service provider token can not be used to add phone number */
    result = await request.post('/PhoneNumbers', {
      auth: {bearer: spA_token},
      resolveWithFullResponse: true,
      simple: false,
      json: true,
      body: {
        number: '16173333456',
        voip_carrier_sid
        }
    });
    t.ok(result.statusCode === 403, 'service provider token can not be used to add phone number');

    /* account token can not be used to add phone number */
    result = await request.post('/PhoneNumbers', {
      auth: {bearer: accA1_token},
      resolveWithFullResponse: true,
      simple: false,
      json: true,
      body: {
        number: '16173333456',
        voip_carrier_sid
        }
    });
    t.ok(result.statusCode === 403, 'account level token can not be used to add phone number');

    /* account level token can not create token for another account */
    result = await request.post('/ApiKeys', {
      resolveWithFullResponse: true,
      simple: false,
      auth: {bearer: accA1_token},
      json: true,
      body: {
        account_sid: accA2
      }
    });
     //console.log(`result: ${JSON.stringify(result)}`);
     t.ok(result.statusCode === 400 && result.body.msg === 'an account level token can only be used to create account level tokens for the same account',
      'an account level token may not be used to create a token for a different account');

    /* account level token can not create service provider token */
    result = await request.post('/ApiKeys', {
      resolveWithFullResponse: true,
      simple: false,
      auth: {bearer: accA1_token},
      json: true,
      body: {
        service_provider_sid: spA_sid
      }
    });
     t.ok(result.statusCode === 400 && result.body.msg === 'an account level token can only be used to create account level tokens for the same account',
      'account level token can not create service provider token');

    /* account level token can not create admin token */
    result = await request.post('/ApiKeys', {
      resolveWithFullResponse: true,
      simple: false,
      auth: {bearer: accA1_token},
      json: true,
      body: {
      }
    });
     t.ok(result.statusCode === 400 && result.body.msg === 'an account level token can only be used to create account level tokens for the same account',
      'account level token can not create admin token');

    /* service provider token can not create admin token */
    result = await request.post('/ApiKeys', {
      resolveWithFullResponse: true,
      simple: false,
      auth: {bearer: spA_token},
      json: true,
      body: {
      }
    });
    //console.log(`result: ${JSON.stringify(result)}`);
    t.ok(result.statusCode === 400 && result.body.msg === 'service provider token may not be used to create admin token',
      'service provider token can not create admin token');

    /* service provider token can not create token for different service provider */
    result = await request.post('/ApiKeys', {
      resolveWithFullResponse: true,
      simple: false,
      auth: {bearer: spA_token},
      json: true,
      body: {
        service_provider_sid: spB_sid
      }
    });
    //console.log(`result: ${JSON.stringify(result)}`);
    t.ok(result.statusCode === 400 && result.body.msg === 'a service provider token can only be used to create tokens for the same service provider',
      'service provider token can not create token for different service provider');
  
    /* service provider token can not create token for account under different service provider */
    result = await request.post('/ApiKeys', {
      resolveWithFullResponse: true,
      simple: false,
      auth: {bearer: spA_token},
      json: true,
      body: {
        account_sid: accB1
      }
    });
    //console.log(`result: ${JSON.stringify(result)}`);
    t.ok(result.statusCode === 400 && result.body.msg === 'a service provider token can only be used to create tokens for the same service provider',
      'service provider token can not create token for account under a different service provider');
  
    /* account level token can create token for the same account */
    result = await request.post('/ApiKeys', {
      resolveWithFullResponse: true,
      simple: false,
      auth: {bearer: accA1_token},
      json: true,
      body: {
        account_sid: accA1
      }
    });
     //console.log(`result: ${JSON.stringify(result)}`);
     t.ok(result.statusCode === 201, 'successfully created a token for the same account using an account level token');
     const accA1_token_sid2 = result.body.sid;
     const accA2_token2 = result.body.token;
 
    /* delete all objects */
    await deleteObjectBySid(request, '/ApiKeys', accA1_token_sid);
    await deleteObjectBySid(request, '/ApiKeys', accA1_token_sid2);
    await deleteObjectBySid(request, '/ApiKeys', spA_token_sid);
    await deleteObjectBySid(request, '/ApiKeys', spB_token_sid);
    await deleteObjectBySid(request, '/Accounts', accA1);
    await deleteObjectBySid(request, '/Accounts', accA2);
    await deleteObjectBySid(request, '/Accounts', accB1);
    await deleteObjectBySid(request, '/Accounts', accB2);
    await deleteObjectBySid(request, '/ServiceProviders', spA_sid);
    await deleteObjectBySid(request, '/ServiceProviders', spB_sid);

    t.end();
  }
  catch (err) {
    console.error(err);
    t.end(err);
  }
});

