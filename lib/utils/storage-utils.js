const { S3Client, ListObjectsCommand } = require('@aws-sdk/client-s3');

async function testAwsS3(logger, {bucket_access_key_id, bucket_secret_access_key, bucket_name}) {
  try {
    const s3 = new S3Client({
      bucket_access_key_id,
      bucket_secret_access_key
    });

    const listObjectsCmd = new ListObjectsCommand({
      Bucket: bucket_name
    });

    const result = await s3.send(listObjectsCmd);
    return result && result.Contents;
  } catch (err) {
    logger.error(err, 'There is error while test AWS S3 credential');
  }
  return false;
}

module.exports = {
  testAwsS3
};
