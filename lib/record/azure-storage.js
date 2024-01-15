const { Writable } = require('stream');
const { BlobServiceClient } = require('@azure/storage-blob');
const { v4: uuidv4 } = require('uuid');
const streamBuffers = require('stream-buffers');

class AzureStorageUploadStream extends Writable {
  constructor(logger, opts) {
    super(opts);
    const blobServiceClient = BlobServiceClient.fromConnectionString(opts.connection_string);
    this.blockBlobClient = blobServiceClient.getContainerClient(opts.bucketName).getBlockBlobClient(opts.Key);

    this.metadata = opts.metadata;
    this.blocks = [];

    this.bufferSize = 2 * 1024 * 1024; // Buffer size set to 2MB
    this.buffer = new streamBuffers.WritableStreamBuffer({
      initialSize: this.bufferSize,
      incrementAmount: this.bufferSize
    });
  }

  async _write(chunk, encoding, callback) {
    this.buffer.write(chunk, encoding);

    if (this.buffer.size() >= this.bufferSize) {
      const blockID = uuidv4().replace(/-/g, '');
      this.blocks.push(blockID);

      try {
        const dataToWrite = this.buffer.getContents();
        await this.blockBlobClient.stageBlock(blockID, dataToWrite, dataToWrite.length);
        callback();
      } catch (error) {
        callback(error);
      }
    } else {
      callback();
    }
  }

  async _final(callback) {
    // Write any remaining data in buffer
    if (this.buffer.size() > 0) {
      const remainingData = this.buffer.getContents();
      const blockID = uuidv4().replace(/-/g, '');
      this.blocks.push(blockID);

      try {
        await this.blockBlobClient.stageBlock(blockID, remainingData, remainingData.length);
      } catch (error) {
        callback(error);
        return;
      }
    }

    try {
      await this.blockBlobClient.commitBlockList(this.blocks);
      // remove all null/undefined props
      const filteredObj = Object.entries(this.metadata).reduce((acc, [key, val]) => {
        if (val !== undefined && val !== null) acc[key] = val;
        return acc;
      }, {});
      await this.blockBlobClient.setMetadata(filteredObj);
      callback();
    } catch (error) {
      callback(error);
    }
  }
}

module.exports = AzureStorageUploadStream;
