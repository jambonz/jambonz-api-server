const test = require('tape') ;
const fs = require('fs');
const jwt = require('jsonwebtoken');
const ADMIN_TOKEN = '38700987-c7a4-4685-a5bb-af378f9734de';
const authAdmin = {bearer: ADMIN_TOKEN};
const request = require('request-promise-native').defaults({
  baseUrl: 'http://127.0.0.1:3000/v1'
});
const {createServiceProvider, createAccount, deleteObjectBySid} = require('./utils');
const { noopLogger } = require('@jambonz/realtimedb-helpers/lib/utils');

process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
});

test('speech credentials tests', async(t) => {
  const app = require('../app');
  const jsonKey = fs.readFileSync(`${__dirname}/data/test.json`, {encoding: 'utf8'});
  let sid;
  try {
    let result;
    const service_provider_sid = await createServiceProvider(request);
    const account_sid = await createAccount(request, service_provider_sid);

    /* add a speech credential to a service provider */
    result = await request.post(`/ServiceProviders/${service_provider_sid}/SpeechCredentials`, {
      resolveWithFullResponse: true,
      simple: false,
      auth: authAdmin,
      json: true,
      body: {
        vendor: 'google',
        service_key: jsonKey
      }
    });
    t.ok(result.statusCode === 201, 'successfully added a speech credential to service provider');
    //console.log(result.body)
    const speech_credential_sid = result.body.sid;

    /* query speech credentials for a service provider */
    result = await request.get(`/ServiceProviders/${service_provider_sid}/SpeechCredentials`, {
      resolveWithFullResponse: true,
      simple: false,
      auth: authAdmin,
      json: true,
    });
    //console.log(result.body)
    t.ok(result.statusCode === 200, 'successfully queried speech credential to service provider');

    await deleteObjectBySid(request, `/ServiceProviders/${service_provider_sid}/SpeechCredentials`, speech_credential_sid);

    const token = jwt.sign({
      account_sid,
      scope: 'account',
      permissions: ["PROVISION_USERS", "PROVISION_SERVICES", "VIEW_ONLY"]
    }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const authUser = {bearer: token};

    /* add a credential  */
    result = await request.post(`/Accounts/${account_sid}/SpeechCredentials`, {
      resolveWithFullResponse: true,
      auth: authUser,
      json: true,
      body: {
        vendor: 'google',
        service_key: jsonKey
      }
    });
    t.ok(result.statusCode === 201, 'successfully added speech credential');
    const sid1 = result.body.sid;

    /* return 403 if invalid account is used  */
    result = await request.post(`/Accounts/foobarbaz/SpeechCredentials`, {
      resolveWithFullResponse: true,
      simple: false,
      auth: authUser,
      json: true,
      body: {
        vendor: 'google',
        service_key: jsonKey
      }
    });
    t.ok(result.statusCode === 403, 'returns 403 Forbidden if Account does not match jwt');
    
    /* query one credential */
    result = await request.get(`/Accounts/${account_sid}/SpeechCredentials/${sid1}`, {
      auth: authAdmin,
      json: true,
    });
    t.ok(result.vendor === 'google' , 'successfully retrieved speech credential by sid');
    
    /* query all credentials */
    result = await request.get(`/Accounts/${account_sid}/SpeechCredentials`, {
      auth: authAdmin,
      json: true,
    });
    t.ok(result[0].vendor === 'google' && result.length === 1, 'successfully retrieved all speech credentials');
    
    
    /* return 404 when deleting unknown credentials */
    result = await request.delete(`/Accounts/${account_sid}/SpeechCredentials/foobarbaz`, {
      auth: authUser,
      resolveWithFullResponse: true,
      simple: false
    });
    t.ok(result.statusCode === 404, 'return 404 when attempting to delete unknown credential');

    /* delete the credential */
    result = await request.delete(`/Accounts/${account_sid}/SpeechCredentials/${sid1}`, {
      auth: authUser,
      resolveWithFullResponse: true,
    });
    t.ok(result.statusCode === 204, 'successfully deleted speech credential');

    /* add a credential for microsoft */
    if (process.env.MICROSOFT_API_KEY && process.env.MICROSOFT_REGION) {
      result = await request.post(`/Accounts/${account_sid}/SpeechCredentials`, {
        resolveWithFullResponse: true,
        auth: authUser,
        json: true,
        body: {
          vendor: 'microsoft',
          use_for_tts: true,
          api_key: process.env.MICROSOFT_API_KEY,
          region: process.env.MICROSOFT_REGION
        }
      });
      t.ok(result.statusCode === 201, 'successfully added speech credential');
      const ms_sid = result.body.sid;

      /* test the speech credential */
      result = await request.get(`/Accounts/${account_sid}/SpeechCredentials/${ms_sid}/test`, {
        resolveWithFullResponse: true,
        auth: authUser,
        json: true,   
      });
      console.log(JSON.stringify(result));
    }

    /* add a credential for wellsaid */
    if (process.env.WELLSAID_API_KEY) {
      result = await request.post(`/Accounts/${account_sid}/SpeechCredentials`, {
        resolveWithFullResponse: true,
        auth: authUser,
        json: true,
        body: {
          vendor: 'wellsaid',
          use_for_tts: true,
          api_key: process.env.WELLSAID_API_KEY
        }
      });
      t.ok(result.statusCode === 201, 'successfully added speech credential');
      const ms_sid = result.body.sid;

      /* test the speech credential */
      result = await request.get(`/Accounts/${account_sid}/SpeechCredentials/${ms_sid}/test`, {
        resolveWithFullResponse: true,
        auth: authUser,
        json: true,   
      });
      console.log(JSON.stringify(result));

      /* delete the credential */
      result = await request.delete(`/Accounts/${account_sid}/SpeechCredentials/${ms_sid}`, {
        auth: authUser,
        resolveWithFullResponse: true,
      });
      t.ok(result.statusCode === 204, 'successfully deleted speech credential');
    }

    await deleteObjectBySid(request, '/Accounts', account_sid);
    await deleteObjectBySid(request, '/ServiceProviders', service_provider_sid);
    //t.end();
  }
  catch (err) {
    console.error(err);
    t.end(err);
  }
});

