const test = require('tape') ;
const ADMIN_TOKEN = '38700987-c7a4-4685-a5bb-af378f9734de';
const authAdmin = {bearer: ADMIN_TOKEN};
const { createClient } = require('./http-client');
const request = createClient({
  baseUrl: 'http://127.0.0.1:3000/v1'
});
const {createVoipCarrier, createServiceProvider, 
  createPhoneNumber, createAccount, deleteObjectBySid
} = require('./utils');

process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
});

test('application tests', async(t) => {
  const app = require('../app');
  let sid;
  try {
    let result;

    /* add service provider, phone number, and voip carrier */
    const voip_carrier_sid = await createVoipCarrier(request);
    const service_provider_sid = await createServiceProvider(request);
    const phone_number_sid = await createPhoneNumber(request, voip_carrier_sid);
    const account_sid = await createAccount(request, service_provider_sid);

    /* add an invalid application app_json */
    result = await request.post('/Applications', {
      resolveWithFullResponse: true,
      simple: false,
      auth: authAdmin,
      json: true,
      body: {
        name: 'daveh',
        account_sid,
        call_hook: {
          url: 'http://example.com'
        },
        call_status_hook: {
          url: 'http://example.com/status',
          method: 'POST'
        },
        messaging_hook: {
          url: 'http://example.com/sms'
        },
        app_json : '[\
            {\
              "verb": "play",\
              "timeoutSecs": 10,\
              "seekOffset": 8000,\
              "actionHook": "/play/action"\
          }\
        ]'
      }
    });
    t.ok(result.statusCode === 400, 'Cant create application with invalid app_json');
    
    /* add an application */
    result = await request.post('/Applications', {
      resolveWithFullResponse: true,
      auth: authAdmin,
      json: true,
      body: {
        name: 'daveh',
        account_sid,
        call_hook: {
          url: 'http://example.com'
        },
        call_status_hook: {
          url: 'http://example.com/status',
          method: 'POST'
        },
        messaging_hook: {
          url: 'http://example.com/sms'
        },
        app_json : '[\
            {\
              "verb": "play",\
              "url": "https://example.com/example.mp3",\
              "timeoutSecs": 10,\
              "seekOffset": 8000,\
              "actionHook": "/play/action"\
          }\
        ]',
        use_for_fallback_speech: 1,
        fallback_speech_synthesis_vendor: 'google',
        fallback_speech_synthesis_language: 'en-US',
        fallback_speech_synthesis_voice: 'man',
        fallback_speech_synthesis_label: 'label1',
        fallback_speech_recognizer_vendor: 'google',
        fallback_speech_recognizer_language: 'en-US',
        fallback_speech_recognizer_label: 'label1'
      }
    });
    t.ok(result.statusCode === 201, 'successfully created application');
    const sid = result.body.sid;

    /* query all applications */
    result = await request.get('/Applications', {
      auth: authAdmin,
      json: true,
    });
    //console.log(`result: ${JSON.stringify(result)}`);
    t.ok(result.length === 1 , 'successfully queried all applications');

    /* query one applications */
    result = await request.get(`/Applications/${sid}`, {
      auth: authAdmin,
      json: true,
    });
    t.ok(result.name === 'daveh' , 'successfully retrieved application by sid');
    t.ok(result.messaging_hook.url === 'http://example.com/sms' , 'successfully retrieved messaging_hook from application');
    t.ok(result.use_for_fallback_speech === 1, 'successfully create use_for_fallback_speech');
    t.ok(result.fallback_speech_synthesis_vendor === 'google', 'successfully create fallback_speech_synthesis_vendor');
    t.ok(result.fallback_speech_synthesis_language === 'en-US', 'successfully create fallback_speech_synthesis_language');
    t.ok(result.fallback_speech_synthesis_voice === 'man', 'successfully create fallback_speech_synthesis_voice');
    t.ok(result.fallback_speech_synthesis_label === 'label1', 'successfully create fallback_speech_synthesis_label');
    t.ok(result.fallback_speech_recognizer_vendor === 'google', 'successfully create fallback_speech_recognizer_vendor');
    t.ok(result.fallback_speech_recognizer_language === 'en-US', 'successfully create fallback_speech_recognizer_language');
    t.ok(result.fallback_speech_recognizer_label === 'label1', 'successfully create fallback_speech_recognizer_label');
    let app_json = JSON.parse(result.app_json);
    t.ok(app_json[0].verb === 'play', 'successfully retrieved app_json from application')

    /* query one application by name*/
    result = await request.get(`/Applications`, {
      qs : {
        name: 'daveh'
      },
      auth: authAdmin,
      json: true,
    });
    t.ok(result.length === 1 && result[0].name === 'daveh', 'successfully queried application by name');

    /* query application with invalid name*/
    result = await request.get(`/Applications`, {
      qs : {
        name: 'daveh-invalid'
      },
      auth: authAdmin,
      json: true,
    });
    t.ok(result.length === 0, 'successfully queried application by invalid name, no results found');

    /* update applications */
    result = await request.put(`/Applications/${sid}`, {
      auth: authAdmin,
      json: true,
      resolveWithFullResponse: true,
      body: {
        call_hook: {
          url: 'http://example2.com'
        },
        messaging_hook: {
          url: 'http://example2.com/mms'
        },
        app_json : '[\
          {\
            "verb": "hangup",\
            "headers": {\
              "X-Reason" : "maximum call duration exceeded"\
            }\
          }\
        ]',
        record_all_calls: true,
        use_for_fallback_speech: 0,
        fallback_speech_synthesis_vendor: 'microsoft',
        fallback_speech_synthesis_language: 'en-US',
        fallback_speech_synthesis_voice: 'woman',
        fallback_speech_synthesis_label: 'label2',
        fallback_speech_recognizer_vendor: 'microsoft',
        fallback_speech_recognizer_language: 'en-US',
        fallback_speech_recognizer_label: 'label2'
      }
    });
    t.ok(result.statusCode === 204, 'successfully updated application');

    /* validate messaging hook was updated */
    result = await request.get(`/Applications/${sid}`, {
      auth: authAdmin,
      json: true,
    });
    t.ok(result.messaging_hook.url === 'http://example2.com/mms' , 'successfully updated messaging_hook');
    app_json = JSON.parse(result.app_json);
    t.ok(app_json[0].verb === 'hangup', 'successfully updated app_json from application')
    t.ok(result.record_all_calls === 1, 'successfully updated record_all_calls from application')
    t.ok(result.use_for_fallback_speech === 0, 'successfully update use_for_fallback_speech');
    t.ok(result.fallback_speech_synthesis_vendor === 'microsoft', 'successfully update fallback_speech_synthesis_vendor');
    t.ok(result.fallback_speech_synthesis_language === 'en-US', 'successfully update fallback_speech_synthesis_language');
    t.ok(result.fallback_speech_synthesis_voice === 'woman', 'successfully update fallback_speech_synthesis_voice');
    t.ok(result.fallback_speech_synthesis_label === 'label2', 'successfully update fallback_speech_synthesis_label');
    t.ok(result.fallback_speech_recognizer_vendor === 'microsoft', 'successfully update fallback_speech_recognizer_vendor');
    t.ok(result.fallback_speech_recognizer_language === 'en-US', 'successfully update fallback_speech_recognizer_language');
    t.ok(result.fallback_speech_recognizer_label === 'label2', 'successfully update fallback_speech_recognizer_label');

    /* remove applications app_json*/
    result = await request.put(`/Applications/${sid}`, {
      auth: authAdmin,
      json: true,
      resolveWithFullResponse: true,
      body: {
        call_hook: {
          url: 'http://example2.com'
        },
        messaging_hook: {
          url: 'http://example2.com/mms'
        },
        app_json : null
      }
    });
    t.ok(result.statusCode === 204, 'successfully updated application');

    /* validate messaging hook was updated */
    result = await request.get(`/Applications/${sid}`, {
      auth: authAdmin,
      json: true,
    });
    t.ok(result.app_json == undefined, 'successfully removed app_json from application')

    /* Update invalid applications app_json*/
    result = await request.put(`/Applications/${sid}`, {
      auth: authAdmin,
      json: true,
      resolveWithFullResponse: true,
      simple: false,
      body: {
        call_hook: {
          url: 'http://example2.com'
        },
        messaging_hook: {
          url: 'http://example2.com/mms'
        },
        app_json : '[\
          {\
            "verb": "play",\
            "timeoutSecs": 10,\
            "seekOffset": 8000,\
            "actionHook": "/play/action"\
        }\
      ]'
      }
    });
    t.ok(result.statusCode === 400, 'Cant update invalid application app_json');
    
    /* assign phone number to application */
    result = await request.put(`/PhoneNumbers/${phone_number_sid}`, {
      auth: authAdmin,
      json: true,
      resolveWithFullResponse: true,
      body: {
        application_sid: sid,
        account_sid
      }
    });
    t.ok(result.statusCode === 204, 'successfully assigned phone number to application');

    /* delete application */
    result = await request.delete(`/Applications/${sid}`, {
      auth: authAdmin,
      resolveWithFullResponse: true,
      simple: false,
      json: true
    });
    //console.log(results);
    t.ok(result.statusCode === 422, 'cannot delete application with phone numbers');

    /* delete application */
    await request.delete(`/PhoneNumbers/${phone_number_sid}`, {auth: authAdmin});
    result = await request.delete(`/Applications/${sid}`, {
      auth: authAdmin,
      resolveWithFullResponse: true,
    });
    //console.log(result);
    t.ok(result.statusCode === 204, 'successfully deleted application after removing phone number');

    await deleteObjectBySid(request, '/Accounts', account_sid);
    await deleteObjectBySid(request, '/VoipCarriers', voip_carrier_sid);
    await deleteObjectBySid(request, '/ServiceProviders', service_provider_sid);

    //t.end();
  }
  catch (err) {
    //console.error(err);
    t.end(err);
  }
});

