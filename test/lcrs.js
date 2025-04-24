const test = require('tape') ;
const { createClient } = require('./http-client');
const ADMIN_TOKEN = '38700987-c7a4-4685-a5bb-af378f9734de';
const authAdmin = {bearer: ADMIN_TOKEN};
const request = createClient({
  baseUrl: 'http://127.0.0.1:3000/v1'
});

process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
});

test('lcr test', async(t) => {
  const app = require('../app');
  let sid;
  try {
    let result;
    /* add new entity */
    result = await request.post('/Lcrs', {
      resolveWithFullResponse: true,
      auth: authAdmin,
      json: true,
      body: {
        name: 'name'
      }
    });
    t.ok(result.statusCode === 201, 'successfully created lcr');
    const sid = result.body.sid;

    /* query all entity */
    result = await request.get('/Lcrs', {
      auth: authAdmin,
      json: true,
    });
    t.ok(result.length === 1 , 'successfully queried all lcr');

    /* query one entity */
    result = await request.get(`/Lcrs/${sid}`, {
      auth: authAdmin,
      json: true,
    });
    t.ok(result.name === 'name' , 'successfully retrieved lcr by sid');

    /* update the entity */
    result = await request.put(`/Lcrs/${sid}`, {
      auth: authAdmin,
      json: true,
      resolveWithFullResponse: true,
      body: {
        name: 'name2'
      }
    });
    t.ok(result.statusCode === 204, 'successfully updated Lcr');
    /* query one entity */
    result = await request.get(`/Lcrs/${sid}`, {
      auth: authAdmin,
      json: true,
    });
    t.ok(result.name === 'name2' , 'successfully updated lcr by sid');

    /* delete lcr Route */
    result = await request.delete(`/Lcrs/${sid}`, {
      resolveWithFullResponse: true,
      simple: false,
      json: true,
      auth: authAdmin
    });
    t.ok(result.statusCode === 204, 'successfully deleted Lcrs');

    t.end();
  }
  catch (err) {
    console.error(err);
    t.end(err);
  }

});
