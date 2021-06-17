const bent = require('bent');
const getJSON = bent('GET', 200);
const request = require('request');
require('request-debug')(request);

const test = async() => {
  request.get('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${process.env.GH_CODE}`,
      Accept: 'application/json',
      'User-Agent': 'jambonz.us'
    }
  }, (err, response, body) => {
    if (err) console.log(error);
    else console.log(body);
  })
};

test();