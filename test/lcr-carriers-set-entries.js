const test = require('tape') ;
const ADMIN_TOKEN = '38700987-c7a4-4685-a5bb-af378f9734de';
const authAdmin = {bearer: ADMIN_TOKEN};
const { createClient } = require('./http-client');
const request = createClient({
  baseUrl: 'http://127.0.0.1:3000/v1'
});

const {createLcrRoute, createVoipCarrier} = require('./utils');

process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
});

test('lcr carrier set entries test', async(t) => {
  const app = require('../app');
  let sid;
  try {
    let result;
    const lcr_route = await createLcrRoute(request);
    const voip_carrier_sid = await createVoipCarrier(request);

    /* add new entity */
    result = await request.post('/LcrCarrierSetEntries', {
      resolveWithFullResponse: true,
      auth: authAdmin,
      json: true,
      body: {
        workload: 1,
        lcr_route_sid: lcr_route.lcr_route_sid,
        voip_carrier_sid,
        priority: 1
      }
    });
    t.ok(result.statusCode === 201, 'successfully created lcr carrier set entry ');
    const sid = result.body.sid;

    /* query all entity */
    result = await request.get('/LcrCarrierSetEntries', {
      qs: {lcr_route_sid: lcr_route.lcr_route_sid},
      auth: authAdmin,
      json: true,
    });
    t.ok(result.length === 1 , 'successfully queried all lcr carrier set entry');

    /* query one entity */
    result = await request.get(`/LcrCarrierSetEntries/${sid}`, {
      auth: authAdmin,
      json: true,
    });
    t.ok(result.workload === 1 , 'successfully retrieved lcr carrier set entry by sid');

    /* update the entity */
    result = await request.put(`/LcrCarrierSetEntries/${sid}`, {
      auth: authAdmin,
      json: true,
      resolveWithFullResponse: true,
      body: {
        priority: 2
      }
    });
    t.ok(result.statusCode === 204, 'successfully updated LcrCarrierSetEntries');
    /* query one entity */
    result = await request.get(`/LcrCarrierSetEntries/${sid}`, {
      auth: authAdmin,
      json: true,
    });
    t.ok(result.priority === 2 , 'successfully updated lcr carrier set entry by sid');

    /* delete lcr carrier set entry */
    result = await request.delete(`/LcrCarrierSetEntries/${sid}`, {
      resolveWithFullResponse: true,
      simple: false,
      json: true,
      auth: authAdmin
    });
    t.ok(result.statusCode === 204, 'successfully deleted LcrCarrierSetEntries');

    /* delete lcr route */
    result = await request.delete(`/LcrRoutes/${lcr_route.lcr_route_sid}`, {
      resolveWithFullResponse: true,
      simple: false,
      json: true,
      auth: authAdmin
    });
    t.ok(result.statusCode === 204, 'successfully deleted LcrRoutes');

    /* delete lcr */
    result = await request.delete(`/Lcrs/${lcr_route.lcr_sid}`, {
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
