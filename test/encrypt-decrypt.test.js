const assert = require('node:assert');
const { describe, it, beforeEach, before } = require('node:test');
const { obscureBucketCredentialsSensitiveData, isObscureKey, obscureKey } = require('../lib/utils/encrypt-decrypt');
const { randomUUID } = require('node:crypto');

let bucket_credential = {};
let service_key = {};

describe('encrypt-decrypt test suite', { skip: false }, () => {
    before(() => {
        process.env.ENCRYPTION_SECRET = "12345";
    });
    beforeEach(() => {
        service_key = {
            "type": "service_account",
            "project_id": "voice-gateway",
            "private_key_id": randomUUID(),
            "private_key": "-----BEGIN PRIVATE KEY-----\nJ6T2sQmBAD8TBm0frkGeyw0FA0aVAASVBJcwggSjBgEAAoabAQDUbiVwgufJm9R3\nv7YpECxRnQgHduX8jnbjtubi6FVqqVx78W3NM/gFNJFBC7NXtpsslqefKM6SmlkK\nNP6XqXy/ppXO8u00se7+cOFhsS6crncnsCeIYPxLFPV8P4BjExi7v88RBdektLeV\nX6sRWhxiYeWe+ORxkyC0KR4IKZjHt7ZHrg0kNQyuNx1KOhJnN3rRUkKSP2zozd1c\n3V+4EfpZjGmlQegXNHzkwUjvTOe6nuyxynWe3smjsSw/3RQda5m674Kh9tnVWEiX\n5KWnfRbWDdEBp5azzOAdeSR5W+qQfS0Jo6blREDQxWfMNmut87m81gmn+DKMhq6k\nV0JVRQStAgMBAAECggEAAf7AsAdI24zUdXkZv98gEuC4S10e2Luoz6Yvm41V3sP6\nWx0mdgY7RB9RW8U4WPnu3GhPGGJj03SyHUuI8Ix15MNM9WGDAaV3S+kRb1LqChLO\nCoNSO/qYPPg4t1iQ9+s7sWTnM93MAXjujmSveHJd7+MrUQOxOdPjB7I/ozMkBXBb\nWYsBIfeOG/7DsC4N4V/hKVXAq9NekGQv85yCUPR/DpuG9vqpztXwaSC1Wihntlu3\nNJYmMave4PbO3OxAekBl70WmukERZo7ksR+34WWse4HXlphaUVbpvnbQdGT1EzXW\nZukanqpfkIwrHme2Ko5NdP0C54pRhg6kpmWszVUMQQKBgQD6yWMuuwdPuFLg0wc2\nnDUeyHZSq/SEMSrb1wNXhL3qhaL2tCjBZwG9CHDuFMhqDLU5F36mEdAsM5MHCzyC\nTJ7VbqvCFz69SRt1CVp76Hu4HO/1Nhxm1GhF+NKSDIbnUg3o4DaC7EUtLpqYXcWj\nsXHEqVEhkrNVQ/JOIfJr42LDfQKBgQDM0U3ghGg9ufe9mb0dOonwtJA/ay/pd08Q\nyq3ue9C3yoQiNf28bP3AGKIjhA6wtd0KTSkQs6ktabGHIM8o/eTrMAMQllKh/3xe\nON7iND8Xz2GFMuIraQ7Mq9RvYWiqqIkVg1GQfJmiQ9wcmGj2PHy25LfjBXfHAYqK\nQ++P/i+s8QKBgD0pRi4MYNEZY+T+skCoQfA69VheJWjj0M8ClgcPEX4Tj1XZRCM+\nqtbeKyR1Hxd19/BvgWyg5YMSJOZP4Dbq1sW4ktzn7F4faTnWySF05k9Vh1PnGXAe\nlzuRXlFOCsx5X3kOzVyKoKhPOFa2b8/nI5bRsD6e12uRAZP6hXO4ZcrFAoGABVJ/\nCpGGP+xgMq4XCvZldTrL8MnxQcjW5iHOKT9QaiY6DsWGZWoTofVB6VhaJV9kcgsV\nQRjaEZMIiPFiULdgRnhF7B1r4kfITI5/xDMFXLIH37U1yVj+iHUCnS5T0PN2NHfo\nG7ARMfU/eALB33ws5XfGC4Et3p78oaEoTX6WcJECgYEAhysSt4qieGRSXn24V0+u\ny/ubU4dysn4SFe8BB4bjgYa8v+6VwucU+nnU4wOwykEgJmzN/ukzpvFN0CkN8eAN\n8xwtjBX9Zc1S90Wf7/7IrQGlUnsSFpDh5TW+oCqVo8JK7UGxJHR1mCvJmYVmSk3c\nD4AMvJ2x/Z5d9NKIAzdET4o=\n-----END PRIVATE KEY-----\n",
            "client_email": "voicegatewayteam@voice-gateway.iam.gserviceaccount.com",
            "client_id": "333827616171177028875",
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/cognigyvoicegatewayteam%40cognigy-voice-gateway.iam.gserviceaccount.com",
            "universe_domain": "googleapis.com"
        };
        bucket_credential = {
            "vendor": "google",
            "service_key": "",
            "connection_string": "",
            "secret_access_key": ""
        }
    });

    describe('obscureBucketCredentialsSensitiveData', { skip: false }, () => {
        it('should obscure "private_key" - vendor: google', { skip: false }, () => {
            bucket_credential = {
                ...bucket_credential,
                "vendor": "google",
                "service_key": JSON.stringify(service_key),
            };
            const result = obscureBucketCredentialsSensitiveData(bucket_credential);
            const googleCredentials = JSON.parse(result.service_key);
            assert.strictEqual(googleCredentials.private_key, '-----BEGIN PRIVATE KEY-----\nJ6T2sQXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
            assert.strictEqual(googleCredentials.private_key_id, googleCredentials.private_key_id);
            assert.strictEqual(googleCredentials.project_id, googleCredentials.project_id);
            assert.strictEqual(googleCredentials.client_email, googleCredentials.client_email);
            assert.strictEqual(googleCredentials.client_id, googleCredentials.client_id);
            assert.strictEqual(googleCredentials.auth_uri, googleCredentials.auth_uri);
            assert.strictEqual(googleCredentials.token_uri, googleCredentials.token_uri);
        });

        it('should skip obscure since it is already obscured. vendor: google - "private key"', { skip: false }, () => {
            service_key.private_key = '-----BEGIN PRIVATE KEY-----\nJ6T2sQXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
            bucket_credential = {
                ...bucket_credential,
                "vendor": "google",
                "service_key": JSON.stringify(service_key),
            };
            const result = obscureBucketCredentialsSensitiveData(bucket_credential);
            const googleCredentials = JSON.parse(result.service_key);
            assert.strictEqual(googleCredentials.private_key, '-----BEGIN PRIVATE KEY-----\nJ6T2sQXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
            assert.strictEqual(googleCredentials.private_key_id, googleCredentials.private_key_id);
            assert.strictEqual(googleCredentials.project_id, googleCredentials.project_id);
            assert.strictEqual(googleCredentials.client_email, googleCredentials.client_email);
            assert.strictEqual(googleCredentials.client_id, googleCredentials.client_id);
            assert.strictEqual(googleCredentials.auth_uri, googleCredentials.auth_uri);
            assert.strictEqual(googleCredentials.token_uri, googleCredentials.token_uri);
        });
    });

    describe('isObscureKey', { skip: false }, () => {
        it('vendor: google - should return true', { skip: false }, () => {
            service_key.private_key = '-----BEGIN PRIVATE KEY-----\nJ6T2sQXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
            bucket_credential = {
                ...bucket_credential,
                "vendor": "google",
                "service_key": JSON.stringify(service_key),
            };
            const result = isObscureKey(bucket_credential);
            assert.strictEqual(result, true);
        });
        it('vendor: google - should return false', { skip: false }, () => {
            bucket_credential = {
                ...bucket_credential,
                "vendor": "google",
                "service_key": JSON.stringify(service_key),
            };
            const result = isObscureKey(bucket_credential);
            assert.strictEqual(result, false);
        });
        it('vendor: aws_s3 - should return true', { skip: false }, () => {
            const obscuredKey = "J6T2sQXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
            bucket_credential = {
                ...bucket_credential,
                "vendor": "aws_s3",
                "secret_access_key": obscuredKey,
            };
            const result = isObscureKey(bucket_credential);
            assert.strictEqual(result, true);
        });
        it('vendor: aws_s3 - should return false', { skip: false }, () => {
            bucket_credential = {
                ...bucket_credential,
                "vendor": "aws_s3",
                "service_key": "EFEU2fhcbqiw3211ffw3f1kezhcbqiw3211ffw3f",
            };
            const result = isObscureKey(bucket_credential);
            assert.strictEqual(result, false);
        });
        it('vendor: azure - should return true', { skip: false }, () => {
            const obscuredKey = 'https:XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
            bucket_credential = {
                ...bucket_credential,
                "vendor": "azure",
                "connection_string": obscuredKey,
            };
            const result = isObscureKey(bucket_credential);
            assert.strictEqual(result, true);
        });
        it('vendor: azure - should return false', { skip: false }, () => {
            bucket_credential = {
                ...bucket_credential,
                "vendor": "azure",
                connection_string: 'https://cognigydevstorage.blob.core.windows.net/voicegateway-test?sp=rw&st=2023-09-10T13:35:44Z&se=2023-09-11T21:35:44Z&spr=https&sv=2022-11-02&sr=c&sig=9WN8Bg5UMOvnV1h1cJpCnTUG%2FnonTbRZ1Q1rbKnDUl4%3D',
            };
            const result = isObscureKey(bucket_credential);
            assert.strictEqual(result, false);
        });
    });
});

