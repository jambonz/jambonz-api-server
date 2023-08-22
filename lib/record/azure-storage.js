const { Writable } = require('stream');
const { BlobServiceClient } = require('@azure/storage-blob');
const { v4: uuidv4 } = require('uuid');

class AzureStorageUploadStream extends Writable {
  constructor(logger, opts) {
    super(opts);
    const blobServiceClient = BlobServiceClient.fromConnectionString(opts.connection_string);
    this.blockBlobClient = blobServiceClient.getContainerClient(opts.bucketName).getBlockBlobClient(opts.Key);
    this.metadata = opts.metadata;
    this.blocks = [];
  }

  _write(chunk, encoding, callback) {
    const blockID = uuidv4().replace(/-/g, '');
    this.blocks.push(blockID);

    this.blockBlobClient.stageBlock(blockID, chunk)
      .then(() => callback())
      .catch(callback);
  }

  async _final(callback) {
    try {
      await this.blockBlobClient.commitBlockList(this.blocks);
      await this.blockBlobClient.setMetadata(this.metadata);
      callback();
    } catch (error) {
      callback(error);
    }
  }
}

module.exports = AzureStorageUploadStream;
