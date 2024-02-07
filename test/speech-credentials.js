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

    /* return 400 if invalid sid param is used */
    try {
      result = await request.post(`/ServiceProviders/foobarbaz/SpeechCredentials`, {
        resolveWithFullResponse: true,
        simple: false,
        auth: authAdmin,
        json: true,
        body: {
          vendor: 'google',
          service_key: jsonKey,
          use_for_tts: true,
          use_for_stt: true
        }
      });
    } catch (err) {
      t.ok(err.statusCode === 400, 'returns 400 bad request if service provider sid param is not a valid uuid');
    }

    /* add a speech credential to a service provider */
    result = await request.post(`/ServiceProviders/${service_provider_sid}/SpeechCredentials`, {
      resolveWithFullResponse: true,
      simple: false,
      auth: authAdmin,
      json: true,
      body: {
        vendor: 'google',
        service_key: jsonKey,
        use_for_tts: true,
        use_for_stt: true
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
      service_provider_sid,
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
        label: 'label1',
        service_key: jsonKey,
        use_for_tts: true,
        use_for_stt: true
      }
    });
    t.ok(result.statusCode === 201, 'successfully added speech credential');
    const sid1 = result.body.sid;

    /* return 403 if invalid account is used - randomSid: bed7ae17-f8b4-4b74-9e5b-4f6318aae9c9 */
    result = await request.post(`/Accounts/bed7ae17-f8b4-4b74-9e5b-4f6318aae9c9/SpeechCredentials`, {
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
    t.ok(result.label === 'label1' , 'label is successfully created');
    
    /* query all credentials */
    result = await request.get(`/Accounts/${account_sid}/SpeechCredentials`, {
      auth: authAdmin,
      json: true,
    });
    t.ok(result[0].vendor === 'google' && result.length === 1, 'successfully retrieved all speech credentials');
    
    
    /* return 400 when deleting credentials with invalid uuid */
    result = await request.delete(`/Accounts/${account_sid}/SpeechCredentials/foobarbaz`, {
      auth: authUser,
      resolveWithFullResponse: true,
      simple: false
    });
    t.ok(result.statusCode === 400, 'return 400 when attempting to delete credential with invalid uuid');

    /* return 404 when deleting unknown credentials - randomSid: bed7ae17-f8b4-4b74-9e5b-4f6318aae9c9 */
    result = await request.delete(`/Accounts/${account_sid}/SpeechCredentials/`, {
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

    /* add / test a credential for google */
    if (process.env.GCP_JSON_KEY) {
      result = await request.post(`/Accounts/${account_sid}/SpeechCredentials`, {
        resolveWithFullResponse: true,
        auth: authUser,
        json: true,
        body: {
          vendor: 'google',
          use_for_tts: true,
          use_for_stt: true,
          service_key: process.env.GCP_JSON_KEY
        }
      });
      t.ok(result.statusCode === 201, 'successfully added speech credential for google');
      const ms_sid = result.body.sid;

      /* test the speech credential */
      result = await request.get(`/Accounts/${account_sid}/SpeechCredentials/${ms_sid}/test`, {
        resolveWithFullResponse: true,
        auth: authUser,
        json: true,   
      });
      //console.log(JSON.stringify(result));
      t.ok(result.statusCode === 200 && result.body.tts.status === 'ok', 'successfully tested speech credential for google tts');
      t.ok(result.statusCode === 200 && result.body.stt.status === 'ok', 'successfully tested speech credential for google stt');
    }

    /* add / test a credential for microsoft */
    if (process.env.MICROSOFT_API_KEY && process.env.MICROSOFT_REGION) {
      result = await request.post(`/Accounts/${account_sid}/SpeechCredentials`, {
        resolveWithFullResponse: true,
        auth: authUser,
        json: true,
        body: {
          vendor: 'microsoft',
          use_for_tts: true,
          use_for_stt: true,
          api_key: process.env.MICROSOFT_API_KEY,
          region: process.env.MICROSOFT_REGION
        }
      });
      t.ok(result.statusCode === 201, 'successfully added speech credential for microsoft');
      const ms_sid = result.body.sid;

      /* test the speech credential */
      result = await request.get(`/Accounts/${account_sid}/SpeechCredentials/${ms_sid}/test`, {
        resolveWithFullResponse: true,
        auth: authUser,
        json: true,   
      });
      //console.log(JSON.stringify(result));
      t.ok(result.statusCode === 200 && result.body.tts.status === 'ok', 'successfully tested speech credential for microsoft tts');
      t.ok(result.statusCode === 200 && result.body.stt.status === 'ok', 'successfully tested speech credential for microsoft stt');
    }

    /* add / test a credential for AWS */
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_REGION) {
      result = await request.post(`/Accounts/${account_sid}/SpeechCredentials`, {
        resolveWithFullResponse: true,
        auth: authUser,
        json: true,
        body: {
          vendor: 'aws',
          use_for_tts: true,
          use_for_stt: true,
          access_key_id: process.env.AWS_ACCESS_KEY_ID,
          secret_access_key: process.env.AWS_SECRET_ACCESS_KEY,
          aws_region: process.env.AWS_REGION
        }
      });
      t.ok(result.statusCode === 201, 'successfully added speech credential for AWS');
      const ms_sid = result.body.sid;

      /* test the speech credential */
      result = await request.get(`/Accounts/${account_sid}/SpeechCredentials/${ms_sid}/test`, {
        resolveWithFullResponse: true,
        auth: authUser,
        json: true,   
      });
      //console.log(JSON.stringify(result));
      t.ok(result.statusCode === 200 && result.body.tts.status === 'ok', 'successfully tested speech credential for AWS tts');
      t.ok(result.statusCode === 200 && result.body.stt.status === 'ok', 'successfully tested speech credential for AWS stt');
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
      //console.log(JSON.stringify(result));
      t.ok(result.statusCode === 200 && result.body.tts.status === 'ok', 'successfully tested speech credential for wellsaid');

      /* delete the credential */
      result = await request.delete(`/Accounts/${account_sid}/SpeechCredentials/${ms_sid}`, {
        auth: authUser,
        resolveWithFullResponse: true,
      });
      t.ok(result.statusCode === 204, 'successfully deleted speech credential');
    }

    /* add a credential for deepgram */
    if (process.env.DEEPGRAM_API_KEY) {
      result = await request.post(`/Accounts/${account_sid}/SpeechCredentials`, {
        resolveWithFullResponse: true,
        auth: authUser,
        json: true,
        body: {
          vendor: 'deepgram',
          use_for_stt: true,
          api_key: process.env.DEEPGRAM_API_KEY
        }
      });
      t.ok(result.statusCode === 201, 'successfully added speech credential for deepgram');
      const ms_sid = result.body.sid;

      /* test the speech credential */
      result = await request.get(`/Accounts/${account_sid}/SpeechCredentials/${ms_sid}/test`, {
        resolveWithFullResponse: true,
        auth: authUser,
        json: true,   
      });
      //console.log(JSON.stringify(result));
      t.ok(result.statusCode === 200 && result.body.stt.status === 'ok', 'successfully tested speech credential for deepgram');

      /* delete the credential */
      result = await request.delete(`/Accounts/${account_sid}/SpeechCredentials/${ms_sid}`, {
        auth: authUser,
        resolveWithFullResponse: true,
      });
      t.ok(result.statusCode === 204, 'successfully deleted speech credential');
    }
    // test create deepgram onprem
    result = await request.post(`/Accounts/${account_sid}/SpeechCredentials`, {
      resolveWithFullResponse: true,
      auth: authUser,
      json: true,
      body: {
        vendor: 'deepgram',
        use_for_stt: true,
        api_key: "Deepgram_fake_ai_key",
        deepgram_uri: "127.0.0.1:50002",
        deepgram_use_tls: true
      }
    });
    t.ok(result.statusCode === 201, 'successfully added speech credential for deepgram');
    const dg_sid = result.body.sid;

    result = await request.get(`/Accounts/${account_sid}/SpeechCredentials/${dg_sid}`, {
      resolveWithFullResponse: true,
      auth: authUser,
      json: true,   
    });
    //console.log(JSON.stringify(result));
    t.ok(result.statusCode === 200, 'successfully get speech credential for deepgram');
    t.ok(result.body.deepgram_uri === '127.0.0.1:50002', "deepgram_uri is correct for deepgram");
    t.ok(result.body.deepgram_use_tls === true, "deepgram_use_tls is correct for deepgram");

    result = await request.put(`/Accounts/${account_sid}/SpeechCredentials/${dg_sid}`, {
      resolveWithFullResponse: true,
      auth: authUser,
      json: true,
      body: {
        vendor: 'deepgram',
        use_for_stt: true,
        api_key: "Deepgram_fake_ai_key",
        deepgram_uri: "127.0.0.2:50002",
        deepgram_use_tls: false
      }
    });
    t.ok(result.statusCode === 204, 'successfully updated speech credential for deepgram onprem');

    result = await request.get(`/Accounts/${account_sid}/SpeechCredentials/${dg_sid}`, {
      resolveWithFullResponse: true,
      auth: authUser,
      json: true,   
    });
    //console.log(JSON.stringify(result));
    t.ok(result.statusCode === 200, 'successfully get speech credential for deepgram onprem');
    t.ok(result.body.deepgram_uri === '127.0.0.2:50002', "deepgram_uri is correct for deepgram onprem");
    t.ok(result.body.deepgram_use_tls === false, "deepgram_use_tls is correct for deepgram onprem");

    result = await request.delete(`/Accounts/${account_sid}/SpeechCredentials/${dg_sid}`, {
      auth: authUser,
      resolveWithFullResponse: true,
    });
    t.ok(result.statusCode === 204, 'successfully deleted speech credential for deepgram onprem');

    /* add a credential for ibm tts */
    if (process.env.IBM_TTS_API_KEY && process.env.IBM_TTS_REGION) {
      result = await request.post(`/Accounts/${account_sid}/SpeechCredentials`, {
        resolveWithFullResponse: true,
        auth: authUser,
        json: true,
        body: {
          vendor: 'ibm',
          use_for_tts: true,
          tts_api_key: process.env.IBM_TTS_API_KEY,
          tts_region: process.env.IBM_TTS_REGION
        }
      });
      t.ok(result.statusCode === 201, 'successfully added speech credential for ibm');
      const ms_sid = result.body.sid;

      /* test the speech credential */
      result = await request.get(`/Accounts/${account_sid}/SpeechCredentials/${ms_sid}/test`, {
        resolveWithFullResponse: true,
        auth: authUser,
        json: true,   
      });
      //console.log(JSON.stringify(result));
      t.ok(result.statusCode === 200 && result.body.tts.status === 'ok', 'successfully tested speech credential for ibm tts');

      /* delete the credential */
      result = await request.delete(`/Accounts/${account_sid}/SpeechCredentials/${ms_sid}`, {
        auth: authUser,
        resolveWithFullResponse: true,
      });
      t.ok(result.statusCode === 204, 'successfully deleted speech credential');
    }

    /* add a credential for ibm stt */
    if (process.env.IBM_STT_API_KEY && process.env.IBM_STT_REGION) {
      result = await request.post(`/Accounts/${account_sid}/SpeechCredentials`, {
        resolveWithFullResponse: true,
        auth: authUser,
        json: true,
        body: {
          vendor: 'ibm',
          use_for_stt: true,
          stt_api_key: process.env.IBM_STT_API_KEY,
          stt_region: process.env.IBM_STT_REGION
        }
      });
      t.ok(result.statusCode === 201, 'successfully added speech credential for ibm');
      const ms_sid = result.body.sid;

      /* test the speech credential */
      result = await request.get(`/Accounts/${account_sid}/SpeechCredentials/${ms_sid}/test`, {
        resolveWithFullResponse: true,
        auth: authUser,
        json: true,   
      });
      //console.log(JSON.stringify(result));
      t.ok(result.statusCode === 200 && result.body.stt.status === 'ok', 'successfully tested speech credential for ibm stt');

      /* delete the credential */
      result = await request.delete(`/Accounts/${account_sid}/SpeechCredentials/${ms_sid}`, {
        auth: authUser,
        resolveWithFullResponse: true,
      });
      t.ok(result.statusCode === 204, 'successfully deleted speech credential');
    }

    /* add a credential for Siniox */
    if (process.env.SONIOX_API_KEY) {
      result = await request.post(`/Accounts/${account_sid}/SpeechCredentials`, {
        resolveWithFullResponse: true,
        auth: authUser,
        json: true,
        body: {
          vendor: 'soniox',
          use_for_stt: true,
          api_key: process.env.SONIOX_API_KEY
        }
      });
      t.ok(result.statusCode === 201, 'successfully added speech credential for soniox');
      const ms_sid = result.body.sid;

      /* test the speech credential */
      result = await request.get(`/Accounts/${account_sid}/SpeechCredentials/${ms_sid}/test`, {
        resolveWithFullResponse: true,
        auth: authUser,
        json: true,   
      });
      console.log(JSON.stringify(result));
      t.ok(result.statusCode === 200 && result.body.stt.status === 'ok', 'successfully tested speech credential for soniox');

      /* delete the credential */
      result = await request.delete(`/Accounts/${account_sid}/SpeechCredentials/${ms_sid}`, {
        auth: authUser,
        resolveWithFullResponse: true,
      });
      t.ok(result.statusCode === 204, 'successfully deleted speech credential');
    }

    /* add a credential for nvidia */
    result = await request.post(`/Accounts/${account_sid}/SpeechCredentials`, {
      resolveWithFullResponse: true,
      auth: authUser,
      json: true,
      body: {
        service_provider_sid: service_provider_sid,
        vendor: 'nvidia',
        use_for_stt: true,
        use_for_tts: true,
        riva_server_uri: "192.168.1.2:5060"
      }
    });
    t.ok(result.statusCode === 201, 'successfully added speech credential for nvidia');
    const ms_sid = result.body.sid;

    /* test the speech credential */
    result = await request.get(`/Accounts/${account_sid}/SpeechCredentials/${ms_sid}/test`, {
      resolveWithFullResponse: true,
      auth: authUser,
      json: true,   
    });
    // TODO Nvidia test.
    t.ok(result.statusCode === 200 && result.body.stt.status === 'not tested', 'successfully tested speech credential for nvida stt');

    /* delete the credential */
    result = await request.delete(`/Accounts/${account_sid}/SpeechCredentials/${ms_sid}`, {
      auth: authUser,
      resolveWithFullResponse: true,
    });
    t.ok(result.statusCode === 204, 'successfully deleted speech credential');

    /* add a credential for nuance */
    result = await request.post(`/Accounts/${account_sid}/SpeechCredentials`, {
      resolveWithFullResponse: true,
      auth: authUser,
      json: true,
      body: {
        vendor: 'nuance',
        use_for_stt: true,
        use_for_tts: true,
        client_id: 'client_id',
        secret: 'secret',
        nuance_tts_uri: "192.168.1.2:5060",
        nuance_stt_uri: "192.168.1.2:5061"
      }
    });
    t.ok(result.statusCode === 201, 'successfully added speech credential for nuance');
    const nuance_sid = result.body.sid;

    /* delete the credential */
    result = await request.delete(`/Accounts/${account_sid}/SpeechCredentials/${nuance_sid}`, {
      auth: authUser,
      resolveWithFullResponse: true,
    });
    t.ok(result.statusCode === 204, 'successfully deleted speech credential');

    /* add a credential for cobalt */
    result = await request.post(`/Accounts/${account_sid}/SpeechCredentials`, {
      resolveWithFullResponse: true,
      auth: authUser,
      json: true,
      body: {
        vendor: 'cobalt',
        use_for_stt: true,
        use_for_tts: false,
        cobalt_server_uri: '32.32.32.32:2727',
      }
    });
    t.ok(result.statusCode === 201, 'successfully added speech credential for Cobalt');
    const cobalt_sid = result.body.sid;

    /* delete the credential */
    result = await request.delete(`/Accounts/${account_sid}/SpeechCredentials/${cobalt_sid}`, {
      auth: authUser,
      resolveWithFullResponse: true,
    });
    t.ok(result.statusCode === 204, 'successfully deleted speech credential for Cobalt');

    /* add a credential for elevenlabs */
    result = await request.post(`/Accounts/${account_sid}/SpeechCredentials`, {
      resolveWithFullResponse: true,
      auth: authUser,
      json: true,
      body: {
        vendor: 'elevenlabs',
        use_for_stt: true,
        use_for_tts: false,
        api_key: 'asdasdasdasddsadasda',
        model_id: 'eleven_multilingual_v2'
      }
    });
    t.ok(result.statusCode === 201, 'successfully added speech credential for Cobalt');
    const elevenlabs_sid = result.body.sid;

    /* delete the credential */
    result = await request.delete(`/Accounts/${account_sid}/SpeechCredentials/${elevenlabs_sid}`, {
      auth: authUser,
      resolveWithFullResponse: true,
    });
    t.ok(result.statusCode === 204, 'successfully deleted speech credential for Cobalt');


    /* add a credential for custom voices google */
    result = await request.post(`/Accounts/${account_sid}/SpeechCredentials`, {
      resolveWithFullResponse: true,
      auth: authUser,
      json: true,
      body: {
        vendor: 'google',
        use_for_stt: true,
        use_for_tts: false,
        service_key: jsonKey
      }
    });
    t.ok(result.statusCode === 201, 'successfully added speech credential for custom voice google');
    const customvoice_google_speech_credential_sid = result.body.sid;

    result = await request.post(`/GoogleCustomVoices`, {
      resolveWithFullResponse: true,
      auth: authUser,
      json: true,
      body: {
        speech_credential_sid: customvoice_google_speech_credential_sid,
        name: "Sally",
        reported_usage: 'REALTIME',
        model: "path/to/modelId"
      }
    });
    t.ok(result.statusCode === 201, 'successfully added custom voice google');
    const customvoice_google_sid = result.body.sid;

    /* delete the credential */
    result = await request.delete(`/GoogleCustomVoices/${customvoice_google_sid}`, {
      auth: authUser,
      resolveWithFullResponse: true,
    });
    t.ok(result.statusCode === 204, 'successfully deleted custom voice google');


    /* delete the credential */
    result = await request.delete(`/Accounts/${account_sid}/SpeechCredentials/${customvoice_google_speech_credential_sid}`, {
      auth: authUser,
      resolveWithFullResponse: true,
    });
    t.ok(result.statusCode === 204, 'successfully deleted speech credential for custom voice google');

    /* add a credential for assemblyAI */
    result = await request.post(`/Accounts/${account_sid}/SpeechCredentials`, {
      resolveWithFullResponse: true,
      auth: authUser,
      json: true,
      body: {
        vendor: 'assemblyai',
        use_for_stt: true,
        api_key: "APIKEY"
      }
    });
    t.ok(result.statusCode === 201, 'successfully added speech credential for assemblyai');
    const assemblyAiSid = result.body.sid;

    /* delete the credential */
    result = await request.delete(`/Accounts/${account_sid}/SpeechCredentials/${assemblyAiSid}`, {
      auth: authUser,
      resolveWithFullResponse: true,
    });
    t.ok(result.statusCode === 204, 'successfully deleted speech credential');

    /* Check google supportedLanguagesAndVoices */
    result = await request.get(`/Accounts/${account_sid}/SpeechCredentials/speech/supportedLanguagesAndVoices?vendor=google`, {
      resolveWithFullResponse: true,
      simple: false,
      auth: authAdmin,
      json: true,
    });
    t.ok(result.body.tts.length !== 0, 'successfully get google supported languages and voices');
    t.ok(result.body.stt.length !== 0, 'successfully get google supported languages and voices');

    /* Check aws supportedLanguagesAndVoices */
    result = await request.get(`/Accounts/${account_sid}/SpeechCredentials/speech/supportedLanguagesAndVoices?vendor=aws`, {
      resolveWithFullResponse: true,
      simple: false,
      auth: authAdmin,
      json: true,
    });
    t.ok(result.body.tts.length !== 0, 'successfully get aws supported languages and voices');
    t.ok(result.body.stt.length !== 0, 'successfully get aws supported languages and voices');

    /* Check microsoft supportedLanguagesAndVoices */
    result = await request.get(`/Accounts/${account_sid}/SpeechCredentials/speech/supportedLanguagesAndVoices?vendor=microsoft`, {
      resolveWithFullResponse: true,
      simple: false,
      auth: authAdmin,
      json: true,
    });
    t.ok(result.body.tts.length !== 0, 'successfully get microsoft supported languages and voices');
    t.ok(result.body.stt.length !== 0, 'successfully get microsoft supported languages and voices');

    /* Check wellsaid supportedLanguagesAndVoices */
    result = await request.get(`/Accounts/${account_sid}/SpeechCredentials/speech/supportedLanguagesAndVoices?vendor=wellsaid`, {
      resolveWithFullResponse: true,
      simple: false,
      auth: authAdmin,
      json: true,
    });
    t.ok(result.body.tts.length !== 0, 'successfully get wellsaid supported languages and voices');

    /* Check nuance supportedLanguagesAndVoices */
    result = await request.get(`/Accounts/${account_sid}/SpeechCredentials/speech/supportedLanguagesAndVoices?vendor=nuance`, {
      resolveWithFullResponse: true,
      simple: false,
      auth: authAdmin,
      json: true,
    });
    t.ok(result.body.tts.length !== 0, 'successfully get nuance supported languages and voices');
    t.ok(result.body.stt.length !== 0, 'successfully get nuance supported languages and voices');

     /* Check deepgram supportedLanguagesAndVoices */
     result = await request.get(`/Accounts/${account_sid}/SpeechCredentials/speech/supportedLanguagesAndVoices?vendor=deepgram`, {
      resolveWithFullResponse: true,
      simple: false,
      auth: authAdmin,
      json: true,
    });
    t.ok(result.body.stt.length !== 0, 'successfully get deepgram supported languages and voices');
    t.ok(result.body.models.length !== 0, 'successfully get deepgram supported languages and voices');

    /* Check ibm supportedLanguagesAndVoices */
    result = await request.get(`/Accounts/${account_sid}/SpeechCredentials/speech/supportedLanguagesAndVoices?vendor=ibm`, {
      resolveWithFullResponse: true,
      simple: false,
      auth: authAdmin,
      json: true,
    });
    t.ok(result.body.tts.length !== 0, 'successfully get ibm supported languages and voices');
    t.ok(result.body.stt.length !== 0, 'successfully get ibm supported languages and voices');

    /* Check ibm supportedLanguagesAndVoices */
    result = await request.get(`/Accounts/${account_sid}/SpeechCredentials/speech/supportedLanguagesAndVoices?vendor=nvidia`, {
      resolveWithFullResponse: true,
      simple: false,
      auth: authAdmin,
      json: true,
    });
    t.ok(result.body.tts.length !== 0, 'successfully get nvidia supported languages and voices');
    t.ok(result.body.stt.length !== 0, 'successfully get nvidia supported languages and voices');

    /* Check cobalt supportedLanguagesAndVoices */
    result = await request.get(`/Accounts/${account_sid}/SpeechCredentials/speech/supportedLanguagesAndVoices?vendor=cobalt`, {
      resolveWithFullResponse: true,
      simple: false,
      auth: authAdmin,
      json: true,
    });
    t.ok(result.body.stt.length !== 0, 'successfully get cobalt supported languages and voices');

    /* Check soniox supportedLanguagesAndVoices */
    result = await request.get(`/Accounts/${account_sid}/SpeechCredentials/speech/supportedLanguagesAndVoices?vendor=soniox`, {
      resolveWithFullResponse: true,
      simple: false,
      auth: authAdmin,
      json: true,
    });
    t.ok(result.body.stt.length !== 0, 'successfully get soniox supported languages and voices');

    /* Check elevenlabs supportedLanguagesAndVoices */
    result = await request.get(`/Accounts/${account_sid}/SpeechCredentials/speech/supportedLanguagesAndVoices?vendor=elevenlabs`, {
      resolveWithFullResponse: true,
      simple: false,
      auth: authAdmin,
      json: true,
    });
    t.ok(result.body.tts.length !== 0, 'successfully get elevenlabs supported languages and voices');
    t.ok(result.body.models.length !== 0, 'successfully get elevenlabs supported languages and voices');

    /* Check assemblyai supportedLanguagesAndVoices */
    result = await request.get(`/Accounts/${account_sid}/SpeechCredentials/speech/supportedLanguagesAndVoices?vendor=assemblyai`, {
      resolveWithFullResponse: true,
      simple: false,
      auth: authAdmin,
      json: true,
    });
    t.ok(result.body.stt.length !== 0, 'successfully get assemblyai supported languages and voices');

    /* Check whisper supportedLanguagesAndVoices */
    result = await request.get(`/Accounts/${account_sid}/SpeechCredentials/speech/supportedLanguagesAndVoices?vendor=whisper`, {
      resolveWithFullResponse: true,
      simple: false,
      auth: authAdmin,
      json: true,
    });
    t.ok(result.body.tts.length !== 0, 'successfully get whisper supported languages and voices');
    t.ok(result.body.models.length !== 0, 'successfully get whisper supported languages and voices');

    await deleteObjectBySid(request, '/Accounts', account_sid);
    await deleteObjectBySid(request, '/ServiceProviders', service_provider_sid);
    t.end();
  }
  catch (err) {
    console.error(err);
    t.end(err);
  }
});

