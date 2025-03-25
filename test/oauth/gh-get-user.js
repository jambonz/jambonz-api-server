const test = async() => {
  fetch('https://api.github.com/user', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${process.env.GH_CODE}`,
      Accept: 'application/json',
      'User-Agent': 'jambonz.cloud'
    }
  }, (err, response, body) => {
    if (err) console.log(error);
    else console.log(body);
  })
};

test();