const test = require('tape').test ;
const ADMIN_TOKEN = '38700987-c7a4-4685-a5bb-af378f9734de';
const authAdmin = {bearer: ADMIN_TOKEN};
const request = require('request-promise-native').defaults({
  baseUrl: 'http://127.0.0.1:3000/v1'
});

process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
});

test('service provider tests', async(t) => {
  const app = require('../app');
  let sid;
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
        name: 'daveh'
      }
    });
    t.ok(result.statusCode === 201, 'successfully created service provider');
    const sid = result.body.sid;

    /* query all service providers */
    result = await request.get('/ServiceProviders', {
      auth: authAdmin,
      json: true,
    });
    t.ok(result.length === 1 , 'successfully queried all service providers');

    /* query one service providers */
    result = await request.get(`/ServiceProviders/${sid}`, {
      auth: authAdmin,
      json: true,
    });
    t.ok(result.name === 'daveh' , 'successfully retrieved service provider by sid');


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

    /* delete service providers */
    result = await request.delete(`/ServiceProviders/${sid}`, {
      auth: authAdmin,
      resolveWithFullResponse: true,
    });
    t.ok(result.statusCode === 204, 'successfully deleted service provider');
    t.end();
  }
  catch (err) {
    console.error(err);
    t.end(err);
  }
});

