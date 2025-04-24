const test = require('tape') ;
const ADMIN_TOKEN = '38700987-c7a4-4685-a5bb-af378f9734de';
const authAdmin = {bearer: ADMIN_TOKEN};
const { createClient } = require('./http-client');
const request = createClient({
  baseUrl: 'http://127.0.0.1:3000/v1'
});

const {createLcr} = require('./utils');

process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
});

test('lcr routes test', async(t) => {
  const app = require('../app');
  let sid;
  try {
    let result;
    const lcr_sid = await createLcr(request);

    /* add new entity */
    result = await request.post('/LcrRoutes', {
      resolveWithFullResponse: true,
      auth: authAdmin,
      json: true,
      body: {
        lcr_sid,
        regex: '1*',
        description: 'description',
        priority: 1
      }
    });
    t.ok(result.statusCode === 201, 'successfully created lcr route ');
    const sid = result.body.sid;

    /* query all entity */
    result = await request.get('/LcrRoutes', {
      qs: {lcr_sid},
      auth: authAdmin,
      json: true,
    });
    t.ok(result.length === 1 , 'successfully queried all lcr route');

    /* query one entity */
    result = await request.get(`/LcrRoutes/${sid}`, {
      auth: authAdmin,
      json: true,
    });
    t.ok(result.priority === 1 , 'successfully retrieved lcr route by sid');

    /* update the entity */
    result = await request.put(`/LcrRoutes/${sid}`, {
      auth: authAdmin,
      json: true,
      resolveWithFullResponse: true,
      body: {
        priority: 2
      }
    });
    t.ok(result.statusCode === 204, 'successfully updated Lcr Route');
    /* query one entity */
    result = await request.get(`/LcrRoutes/${sid}`, {
      auth: authAdmin,
      json: true,
    });
    t.ok(result.priority === 2 , 'successfully updated lcr Route by sid');

    /* delete lcr Route */
    result = await request.delete(`/LcrRoutes/${sid}`, {
      resolveWithFullResponse: true,
      simple: false,
      json: true,
      auth: authAdmin
    });
    t.ok(result.statusCode === 204, 'successfully deleted LcrRoutes');

    /* delete lcr */
    result = await request.delete(`/Lcrs/${lcr_sid}`, {
        resolveWithFullResponse: true,
        simple: false,
        json: true,
        auth: authAdmin
      });
      t.ok(result.statusCode === 204, 'successfully deleted Lcr');

    t.end();
  }
  catch (err) {
    console.error(err);
    t.end(err);
  }

});
