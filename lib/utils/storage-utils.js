const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const {Storage} = require('@google-cloud/storage');
const fs = require('fs');
const { BlobServiceClient } = require('@azure/storage-blob');

// Azure

async function testAzureStorage(logger, opts) {
  const blobServiceClient = BlobServiceClient.fromConnectionString(opts.connection_string);
  const containerClient = blobServiceClient.getContainerClient(opts.name);
  const blockBlobClient = containerClient.getBlockBlobClient('jambonz-sample.text');

  await blockBlobClient.uploadFile(`${__dirname}/jambonz-sample.text`);
}

async function getAzureStorageObject(logger, opts) {
  const blobServiceClient = BlobServiceClient.fromConnectionString(opts.connection_string);
  const containerClient = blobServiceClient.getContainerClient(opts.name);
  const blockBlobClient = containerClient.getBlockBlobClient(opts.key);
  const response = await blockBlobClient.download(0);
  return response.readableStreamBody;
}

async function deleteAzureStorageObject(logger, opts) {
  const blobServiceClient = BlobServiceClient.fromConnectionString(opts.connection_string);
  const containerClient = blobServiceClient.getContainerClient(opts.name);
  const blockBlobClient = containerClient.getBlockBlobClient(opts.key);
  await blockBlobClient.delete();
}

// Google

function _initGoogleClient(opts) {
  const serviceKey = JSON.parse(opts.service_key);
  return new Storage({
    projectId: serviceKey.project_id,
    credentials: {
      client_email: serviceKey.client_email,
      private_key: serviceKey.private_key
    },
  });
}

async function testGoogleStorage(logger, opts) {
  return new Promise((resolve, reject) => {
    const storage = _initGoogleClient(opts);

    const blob = storage.bucket(opts.name).file('jambonz-sample.text');

    fs.createReadStream(`${__dirname}/jambonz-sample.text`)
      .pipe(blob.createWriteStream())
      .on('error', (err) => reject(err))
      .on('finish', () => resolve());
  });
}

async function getGoogleStorageObject(logger, opts) {
  const storage = _initGoogleClient(opts);

  const bucket = storage.bucket(opts.name);
  const file = bucket.file(opts.key);
  const [exists] = await file.exists();
  if (exists) {
    return file.createReadStream();
  }
}

async function deleteGoogleStorageObject(logger, opts) {
  const storage = _initGoogleClient(opts);

  const bucket = storage.bucket(opts.name);
  const file = bucket.file(opts.key);

  await file.delete();
}

// AWS S3

function _initS3Client(opts) {
  return new S3Client({
    credentials: {
      accessKeyId: opts.access_key_id,
      secretAccessKey: opts.secret_access_key,
    },
    region: opts.region || 'us-east-1'
  });
}

async function testAwsS3(logger, opts) {
  const s3 = _initS3Client(opts);

  const input = {
    'Body': 'Hello From Jambonz',
    'Bucket': opts.name,
    'Key': 'jambonz-sample.text'
  };

  const command = new PutObjectCommand(input);

  await s3.send(command);
}

async function getS3Object(logger, opts) {
  const s3 = _initS3Client(opts);
  const command = new GetObjectCommand(
    {
      Bucket: opts.name,
      Key: opts.key
    }
  );
  const res = await s3.send(command);
  return res.Body;
}

async function deleteS3Object(logger, opts) {
  const s3 = _initS3Client(opts);

  const command = new DeleteObjectCommand(
    {
      Bucket: opts.name,
      Key: opts.key
    }
  );
  await s3.send(command);
}

module.exports = {
  testAwsS3,
  getS3Object,
  deleteS3Object,
  testGoogleStorage,
  getGoogleStorageObject,
  deleteGoogleStorageObject,
  testAzureStorage,
  getAzureStorageObject,
  deleteAzureStorageObject
};
