const test = require('tape') ;
const noopLogger = {debug: () => {}, info: () => {}, error: () => {}};
const fs = require('fs');

test('homer tests', async(t, done) => {
  //const {getHomerApiKey, getHomerSipTrace, getHomerPcap} = require('../lib/utils/homer-utils');
  if (process.env.HOMER_BASE_URL && process.env.HOMER_USERNAME && process.env.HOMER_PASSWORD) {
    try {
      /* get a token */
      /*
      let token = await getHomerApiKey(noopLogger);
      console.log(token);
      t.ok(token, 'successfully created an api key for homer');
      const result = await getHomerSipTrace(noopLogger, token, '224f0f24-69aa-123a-eaa6-0ea24be4d211');
      console.log(`got trace: ${JSON.stringify(result)}`);

      var writeStream = fs.createWriteStream('./call.pcap');
      const stream = await getHomerPcap(noopLogger, token, ['224f0f24-69aa-123a-eaa6-0ea24be4d211']);
      stream.pipe(writeStream);
      stream.on('end', () => {
        console.log('finished writing');
        done();
      });
      */

      let result = await request.get('/RecentCalls/224f0f24-69aa-123a-eaa6-0ea24be4d211', {
        resolveWithFullResponse: true,
        auth: authAdmin,
        json: true,
        body: {
          service_provider_sid,
          account_sid,
          tenant_fqdn: 'foo.bar.baz'
        }
      });
      t.ok(result.statusCode === 201, 'successfully added ms teams tenant');
  
    }
    catch (err) {
      console.error(err);
      t.end(err);
    }  
  }
});

