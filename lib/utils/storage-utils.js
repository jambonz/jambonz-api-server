const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const {Storage} = require('@google-cloud/storage');
const fs = require('fs');

function testGoogleStorage(logger, opts) {
  return new Promise((resolve, reject) => {
    const serviceKey = JSON.parse(opts.service_key);
    const storage = new Storage({
      projectId: serviceKey.project_id,
      credentials: {
        client_email: serviceKey.client_email,
        private_key: serviceKey.private_key
      },
    });

    const blob = storage.bucket(opts.name).file('jambonz-sample.text');

    fs.createReadStream(`${__dirname}/jambonz-sample.text`)
      .pipe(blob.createWriteStream())
      .on('error', (err) => reject(err))
      .on('finish', () => resolve());
  });
}

async function getGoogleStorageObject(logger, opts) {
  const serviceKey = JSON.parse(opts.service_key);
  const storage = new Storage({
    projectId: serviceKey.project_id,
    credentials: {
      client_email: serviceKey.client_email,
      private_key: serviceKey.private_key
    },
  });

  const bucket = storage.bucket(opts.name);
  const file = bucket.file(opts.key);

  return file.createReadStream();
}

async function testAwsS3(logger, opts) {
  const s3 = new S3Client({
    credentials: {
      accessKeyId: opts.access_key_id,
      secretAccessKey: opts.secret_access_key,
    },
    region: opts.region || 'us-east-1'
  });

  const input = {
    'Body': 'Hello From Jambonz',
    'Bucket': opts.name,
    'Key': 'jambonz-sample.text'
  };

  const command = new PutObjectCommand(input);

  await s3.send(command);
}

async function getS3Object(logger, opts) {
  const s3 = new S3Client({
    credentials: {
      accessKeyId: opts.access_key_id,
      secretAccessKey: opts.secret_access_key,
    },
    region: opts.region || 'us-east-1'
  });
  const command = new GetObjectCommand({
    Bucket: opts.name,
    Key: opts.key
  });
  const res = await s3.send(command);
  return res.Body;
}

module.exports = {
  testAwsS3,
  getS3Object,
  testGoogleStorage,
  getGoogleStorageObject
};
