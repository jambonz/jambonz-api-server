const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

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

module.exports = {
  testAwsS3,
};
