const assert = require('assert');
const fs = require('fs');
const express = require('express');
const app = express();
const listenPort = process.env.HTTP_PORT || 3000;
const { v4: uuidv4 } = require('uuid');
let hook_mapping = new Map();

app.listen(listenPort, () => {
  console.log(`sample jambones app server listening on ${listenPort}`);
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

/*
 * CreateCall
 */

app.all('/v1/createCall', (req, res) => {
  console.log(req.body, 'POST /v1/createCall');
  const key = req.body.from + '_createCall'
  addRequestToMap(key, req, hook_mapping);
  res.status(201).json({
    sid: uuidv4(),
    callId: uuidv4()
  });
});

// Fetch Requests
app.get('/requests/:key', (req, res) => {
  let key = req.params.key;
  if (hook_mapping.has(key)) {
    return res.json(hook_mapping.get(key));
  } else {
    return res.sendStatus(404);
  }

})

app.get('/lastRequest/:key', (req, res) => {
  let key = req.params.key;
  if (hook_mapping.has(key)) {
    let requests = hook_mapping.get(key);
    return res.json(requests[requests.length - 1]);
  } else {
    return res.sendStatus(404);
  }
})

/*
 * private function
 */

function addRequestToMap(key, req, map) {
  let headers = new Map()
  for(let i = 0; i < req.rawHeaders.length; i++) {
    if (i % 2 === 0) {
      headers.set(req.rawHeaders[i], req.rawHeaders[i + 1])
    }
  }
  let request = {
    'url': req.url,
    'headers': Object.fromEntries(headers),
    'body': req.body
  }
  if (map.has(key)) {
    map.get(key).push(request);
  } else {
    map.set(key, [request]);
  }
}
