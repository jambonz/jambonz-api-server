const test = require('tape') ;
const ADMIN_TOKEN = '38700987-c7a4-4685-a5bb-af378f9734de';
const authAdmin = {bearer: ADMIN_TOKEN};
const request = require('request-promise-native').defaults({
  baseUrl: 'http://127.0.0.1:3000/v1'
});
const {deleteObjectBySid} = require('./utils');

process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
});

test('service provider tests', async(t) => {
  const app = require('../app');
  try {
    let result;
    result = await request.post('/ServiceProviders', {
      simple: false,
      resolveWithFullResponse: true,
      //auth: authAdmin,
      json: true,
      body: {
        name: 'daveh'
      }
    });
    t.ok(result.statusCode === 401, 'fails with 401 if Bearer token not supplied');

    /* add a service provider */
    result = await request.post('/ServiceProviders', {
      resolveWithFullResponse: true,
      auth: authAdmin,
      json: true,
      body: {
        name: 'daveh',
        ms_teams_fqdn: 'contoso.com'
      }
    });
    t.ok(result.statusCode === 201, 'successfully created service provider');
    const sid = result.body.sid;

    /* add a second service provider */
    result = await request.post('/ServiceProviders', {
      resolveWithFullResponse: true,
      auth: authAdmin,
      json: true,
      body: {
        name: 'johndoe',
        root_domain: 'example.com',
        registration_hook: {
          url: 'http://a.com'
        }
      }
    });
    t.ok(result.statusCode === 201, 'successfully created service provider with a root domain');
    const sid2 = result.body.sid;

    /* cannot add a service provider with same name*/
    result = await request.post('/ServiceProviders', {
      resolveWithFullResponse: true,
      simple: false,
      auth: authAdmin,
      json: true,
      body: {
        name: 'daveh'
      }
    });
    //console.log(`result: ${JSON.stringify(result)}`);
    t.ok(result.statusCode === 422, 'cannot add two service providers with the same name');

    /* cannot add a service provider with same root domain*/
    result = await request.post('/ServiceProviders', {
      resolveWithFullResponse: true,
      simple: false,
      auth: authAdmin,
      json: true,
      body: {
        name: 'janedoe',
        root_domain: 'example.com'
      }
    });
    //console.log(`result: ${JSON.stringify(result)}`);
    t.ok(result.statusCode === 422, 'cannot add two service providers with the same root domain');
    
    /* query all service providers */
    result = await request.get('/ServiceProviders', {
      auth: authAdmin,
      json: true,
    });
    //console.log(JSON.stringify(result));
    t.ok(result.length === 2 , 'successfully queried all service providers');

    /* query one service providers */
    result = await request.get(`/ServiceProviders/${sid2}`, {
      auth: authAdmin,
      json: true,
    });
    t.ok(result.name === 'johndoe' && result.root_domain === 'example.com', 'successfully retrieved service provider by sid');

    /* update service providers */
    result = await request.put(`/ServiceProviders/${sid}`, {
      auth: authAdmin,
      json: true,
      resolveWithFullResponse: true,
      body: {
        name: 'robb'
      }
    });
    t.ok(result.statusCode === 204, 'successfully updated service provider');

    /* try to update service provider with invalid sid param */
    result = await request.put(`/ServiceProviders/123`, {
      auth: authAdmin,
      json: true,
      resolveWithFullResponse: true,
      body: {
        name: 'robb'
      }
    });
    t.ok(result.statusCode === 400, 'returns 400 Bad Request if sid param is not a valid uuid');

    /* add an api key for a service provider */
    result = await request.post(`/ApiKeys`, {
      auth: authAdmin,
      json: true,
      resolveWithFullResponse: true,
      body: {
        service_provider_sid: sid
      }
    });
    t.ok(result.statusCode === 201, 'successfully added an api_key for a service provider');
    const apiKeySid = result.body.sid;

    /* query all api keys for a service provider */
    result = await request.get(`/ServiceProviders/${sid}/ApiKeys`, {
      auth: authAdmin,
      json: true,
    });
    t.ok(result.length === 1 , 'successfully queried all service provider keys');
    
    /* delete an api key */
    result = await request.delete(`/ApiKeys/${apiKeySid}`, {
      auth: authAdmin,
      json: true,
      resolveWithFullResponse: true,
    });
    t.ok(result.statusCode === 204, 'successfully deleted an api_key for a service provider');
    
    /* add a predefined carrier for a service provider */
    result = await request.post(`/ServiceProviders/${sid}/PredefinedCarriers/7d509a18-bbff-4c5d-b21e-b99bf8f8c49a`, {
      auth: authAdmin,
      json: true,
      resolveWithFullResponse: true,
    });
    t.ok(result.statusCode === 201, 'successfully added predefined carrier to service provider');
    await deleteObjectBySid(request, '/VoipCarriers', result.body.sid);

    /* add a limit for a service provider */
    result = await request.post(`/ServiceProviders/${sid}/Limits`, {
      auth: authAdmin,
      json: true,
      resolveWithFullResponse: true,
      body: {
        category: 'voice_call_session',
        quantity: 1000
      }
    });
    t.ok(result.statusCode === 201, 'successfully added a call session limit to service provider');

    /* query all limits for a service provider */
    result = await request.get(`/ServiceProviders/${sid}/Limits`, {
      auth: authAdmin,
      json: true,
    });
    //console.log(result);
    t.ok(result.length === 1 , 'successfully queried all limits');

    /* delete call session limits for a service provider */
    result = await request.delete(`/ServiceProviders/${sid}/Limits?category=voice_call_session`, {
      auth: authAdmin,
      resolveWithFullResponse: true
    });
    t.ok(result.statusCode === 204, 'successfully deleted a call session limit for a service provider');

    /* delete service providers */
    result = await request.delete(`/ServiceProviders/${sid}`, {
      auth: authAdmin,
      resolveWithFullResponse: true,
    });
    t.ok(result.statusCode === 204, 'successfully deleted service provider 1');
    result = await request.delete(`/ServiceProviders/${sid2}`, {
      auth: authAdmin,
      resolveWithFullResponse: true,
    });
    t.ok(result.statusCode === 204, 'successfully deleted service provider 2');
    //t.end();
  }
  catch (err) {
    console.error(err);
    t.end(err);
  }
});

