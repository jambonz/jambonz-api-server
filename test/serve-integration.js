const exec = require('child_process').exec ;
const { sippUac } = require('./sipp')('test_jambonz-api');
let stopping = false;

process.on('SIGINT', async() => {
  if (stopping) return;
  stopping = true;
  console.log('shutting down');
  // await stopDocker();
  process.exit(0);
});

const startDocker = () => {
  return new Promise((resolve, reject) => {
    console.log('starting dockerized mysql and redis..')
    exec(`docker-compose -f ${__dirname}/docker-compose-testbed.yaml up -d`, (err) => {
      if (err) return reject(err);
      setTimeout(() => {
        console.log('mysql is running');
        resolve();
      }, 10000);
    });
  });
};

const createDb = () => {
  return new Promise((resolve, reject) => {
    console.log('creating database..')
    exec(`mysql -h 127.0.0.1 -u root --protocol=tcp --port=3360 < ${__dirname}/../db/create_test_db.sql`, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
};

const createSchema = () => {
  return new Promise((resolve, reject) => {
    console.log('creating schema..')
  exec(`mysql -h 127.0.0.1 -u root  --protocol=tcp --port=3360 -D jambones_test < ${__dirname}/../db/jambones-sql.sql`, (err, stdout, stderr) => {
      if (err) return reject(err);
      resolve();
    });
  });
};

const seedDb = () => {
  return new Promise((resolve, reject) => {
    console.log('seeding database..')
    exec(`mysql -h 127.0.0.1 -u root --protocol=tcp --port=3360 -D jambones_test < ${__dirname}/../db/seed-integration-test.sql`, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
};

const resetAdminPassword = () => {
  return new Promise((resolve, reject) => {
    /* not needed when running jambonz hosting mode */
    if (process.env.STRIPE_API_KEY) return resolve();
    console.log('creating admin user..')
    exec(`node ${__dirname}/../db/reset_admin_password.js`, (err, stdout, stderr) => {
      console.log(stdout);
      console.log(stderr);
      if (err) return reject(err);
      resolve();
    });
  });
};

const generateSipTrace = async() => {
  try {
    await sippUac('uac.xml', '172.58.0.30');
  } catch (err) {
    console.log(err);
  }
};

const stopDocker = () => {
  return new Promise((resolve, reject) => {
    console.log('stopping docker network..')
    exec(`docker-compose -f ${__dirname}/docker-compose-testbed.yaml down`, (err) => {
      if (err) return reject(err);
      resolve();
    });
  })
};

require('..');

// startDocker()
//   .then(createDb)
//   .then(createSchema)
//   .then(seedDb)
//   .then(resetAdminPassword)
//   .then(generateSipTrace)
//   .then(() => {
//     console.log('ready for testing!');
//     require('..');
//   })
//   .catch(async(err) => {
//     console.error({err}, 'Error running integration test');
//     await stopDocker();
//     process.exit(-1);
//   });
