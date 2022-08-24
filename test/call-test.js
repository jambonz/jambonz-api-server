const test = require('tape');
const jwt = require('jsonwebtoken');
const request = require('request-promise-native').defaults({
  baseUrl: 'http://127.0.0.1:3000/v1'
});
const consoleLogger = { debug: console.log, info: console.log, error: console.error }
const {
  createServiceProvider,
  createAccount,
  createGoogleSpeechCredentials,
  getLastRequestFromFeatureServer
} = require('./utils');

test('Create Call Success With Synthesizer in Payload', async (t) => {
  // GIVEN
  const app = require('../app');
  let result;
  const service_provider_sid = await createServiceProvider(request, 'account_has_synthesizer');
  const account_sid = await createAccount(request, service_provider_sid, 'account_has_synthesizer');
  const token = jwt.sign({
    account_sid
  }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const authUser = { bearer: token };
  const speech_sid = await createGoogleSpeechCredentials(request, account_sid, null, authUser, true, true)

  // WHEN
  result = await request.post(`/Accounts/${account_sid}/Calls`, {
    resolveWithFullResponse: true,
    auth: authUser,
    json: true,
    body: {
      call_hook: "https://public-apps.jambonz.us/hello-world",
      call_status_hook: "https://public-apps.jambonz.us/call-status",
      from: "15083778299",
      to: {
        type: "phone",
        number: "15089084809"
      },
      speech_synthesis_vendor: "google",
      speech_synthesis_language: "en-US",
      speech_synthesis_voice: "en-US-Standard-C",
      speech_recognizer_vendor: "google",
      speech_recognizer_language: "en-US"
    }
  });
  // THEN
  t.ok(result.statusCode === 201, 'successfully created Call without Synthesizer && application_sid');
  const fs_request = await getLastRequestFromFeatureServer('15083778299_createCall');
  const obj = JSON.parse(fs_request);
  t.ok(obj.body.speech_synthesis_vendor == 'google', 'speech synthesizer successfully added')
  t.ok(obj.body.speech_recognizer_vendor == 'google', 'speech recognizer successfully added')
});

test('Create Call Success Without Synthesizer in Payload', async (t) => {
  // GIVEN
  const app = require('../app');
  let result;
  const service_provider_sid = await createServiceProvider(request, 'account2_has_synthesizer');
  const account_sid = await createAccount(request, service_provider_sid, 'account2_has_synthesizer');
  const token = jwt.sign({
    account_sid
  }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const authUser = { bearer: token };
  const speech_sid = await createGoogleSpeechCredentials(request, account_sid, null, authUser, true, true)

  // WHEN
  result = await request.post(`/Accounts/${account_sid}/Calls`, {
    resolveWithFullResponse: true,
    auth: authUser,
    json: true,
    body: {
      call_hook: "https://public-apps.jambonz.us/hello-world",
      call_status_hook: "https://public-apps.jambonz.us/call-status",
      from: "15083778299",
      to: {
        type: "phone",
        number: "15089084809"
      }
    }
  }).then(data => { t.ok(false, 'Create Call should not be success') })
    .catch(error => { t.ok(error.response.statusCode === 400, 'Call failed for no synthesizer') });
});