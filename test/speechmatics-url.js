const test = require('tape');
const {speechmaticsRealtimeUrl} = require('../lib/utils/speech-utils');

/* the runtime hands speechmatics_stt_uri to mod_speechmatics_transcribe as a bare hostname and
   always dials wss on 443 with a path of /v2, so anything else must fail the credential test
   rather than pass against a url only the test can reach
*/
test('speechmatics-url', (t) => {
  t.equal(speechmaticsRealtimeUrl('eu2.rt.speechmatics.com'),
    'wss://eu2.rt.speechmatics.com/v2', 'builds the url the runtime dials');
  t.equal(speechmaticsRealtimeUrl('wus.rt.speechmatics.com'),
    'wss://wus.rt.speechmatics.com/v2', 'honors the configured region');
  t.equal(speechmaticsRealtimeUrl('sm-container.internal'),
    'wss://sm-container.internal/v2', 'accepts an on-prem hostname');
  t.equal(speechmaticsRealtimeUrl('  neu.rt.speechmatics.com  '),
    'wss://neu.rt.speechmatics.com/v2', 'trims surrounding whitespace');

  for (const uri of [undefined, null, '', '   ']) {
    t.throws(() => speechmaticsRealtimeUrl(uri), /is not set on this speech credential/,
      `rejects a credential with no host: ${JSON.stringify(uri)}`);
  }

  for (const uri of [
    'wss://eu2.rt.speechmatics.com/v2',
    'https://eu2.rt.speechmatics.com',
    'sm-container.internal:9000',
    'eu2.rt.speechmatics.com/v2',
    'my host'
  ]) {
    t.throws(() => speechmaticsRealtimeUrl(uri), /expected a bare hostname/,
      `rejects a shape the runtime cannot dial: ${uri}`);
  }

  t.end();
});
