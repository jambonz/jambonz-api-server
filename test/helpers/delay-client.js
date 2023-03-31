const test = require('tape');
const { delayClient } = require('../../lib/helpers');
const bent = require('bent');
const getJSON = bent('json')
const logger = {
  debug: () => { },
  info: () => { }
}

test('delay-client-test', async (t) => {
  const promise = delayClient.delayPromise(1000)

  await promise();
  t.pass('delayed 1 second');
  t.end();
});