#!/usr/bin/env node
/* eslint-disable max-len */
const assert = require('assert');
const mysql = require('mysql2/promise');
const {readFile} = require('fs/promises');
const {execSync} = require('child_process');
const {version:desiredVersion} = require('../package.json');
const logger = require('pino')();
const fs = require('fs');

logger.info(`upgrade-jambonz-db: desired version ${desiredVersion}`);

assert.ok(process.env.JAMBONES_MYSQL_HOST, 'missing env JAMBONES_MYSQL_HOST');
assert.ok(process.env.JAMBONES_MYSQL_DATABASE, 'missing env JAMBONES_MYSQL_DATABASE');
assert.ok(process.env.JAMBONES_MYSQL_PASSWORD, 'missing env JAMBONES_MYSQL_PASSWORD');
assert.ok(process.env.JAMBONES_MYSQL_USER, 'missing env JAMBONES_MYSQL_USER');

const opts = {
  host: process.env.JAMBONES_MYSQL_HOST,
  user: process.env.JAMBONES_MYSQL_USER,
  password: process.env.JAMBONES_MYSQL_PASSWORD,
  database: process.env.JAMBONES_MYSQL_DATABASE,
  port: process.env.JAMBONES_MYSQL_PORT || 3306,
  multipleStatements: true
};
const rejectUnauthorized = process.env.JAMBONES_MYSQL_REJECT_UNAUTHORIZED;
const ssl_ca_file = process.env.JAMBONES_MYSQL_SSL_CA_FILE;
const ssl_cert_file = process.env.JAMBONES_MYSQL_SSL_CERT_FILE;
const ssl_key_file = process.env.JAMBONES_MYSQL_SSL_KEY_FILE;
const sslFilesProvided = Boolean(ssl_ca_file && ssl_cert_file && ssl_key_file);
if (rejectUnauthorized !== undefined || sslFilesProvided) {
  opts.ssl = {
    ...(rejectUnauthorized !== undefined && { rejectUnauthorized: rejectUnauthorized === '0' ? false : true }),
    ...(ssl_ca_file && { ca: fs.readFileSync(ssl_ca_file) }),
    ...(ssl_cert_file && { cert: fs.readFileSync(ssl_cert_file) }),
    ...(ssl_key_file && { key: fs.readFileSync(ssl_key_file) })
  };
}


const sql = {
  '7006': [
    'ALTER TABLE `accounts` ADD COLUMN `siprec_hook_sid` CHAR(36)',
    'ALTER TABLE accounts ADD FOREIGN KEY siprec_hook_sid_idxfk (siprec_hook_sid) REFERENCES applications (application_sid)'
  ],
  '7007': [
    `CREATE TABLE service_provider_limits 
    (service_provider_limits_sid CHAR(36) NOT NULL UNIQUE,
    service_provider_sid CHAR(36) NOT NULL,
    category ENUM('api_rate','voice_call_session', 'device') NOT NULL,
    quantity INTEGER NOT NULL,
    PRIMARY KEY (service_provider_limits_sid)
    )`,
    `CREATE TABLE account_limits
    (
    account_limits_sid CHAR(36) NOT NULL UNIQUE ,
    account_sid CHAR(36) NOT NULL,
    category ENUM('api_rate','voice_call_session', 'device') NOT NULL,
    quantity INTEGER NOT NULL,
    PRIMARY KEY (account_limits_sid)
    )`,
    'CREATE INDEX service_provider_sid_idx ON service_provider_limits (service_provider_sid)',
    `ALTER TABLE service_provider_limits 
    ADD FOREIGN KEY service_provider_sid_idxfk_3 (service_provider_sid) 
    REFERENCES service_providers (service_provider_sid) 
    ON DELETE CASCADE`,
    'CREATE INDEX account_sid_idx ON account_limits (account_sid)',
    `ALTER TABLE account_limits 
    ADD FOREIGN KEY account_sid_idxfk_2 (account_sid) 
    REFERENCES accounts (account_sid) 
    ON DELETE CASCADE`,
    'ALTER TABLE `voip_carriers` ADD COLUMN `register_from_user` VARCHAR(128)',
    'ALTER TABLE `voip_carriers` ADD COLUMN `register_from_domain` VARCHAR(256)',
    'ALTER TABLE `voip_carriers` ADD COLUMN `register_public_ip_in_contact` BOOLEAN NOT NULL DEFAULT false'
  ],
  '8000': [
    'ALTER TABLE `applications` ADD COLUMN `app_json` TEXT',
    'ALTER TABLE voip_carriers CHANGE register_public_domain_in_contact register_public_ip_in_contact BOOLEAN',
    'alter table phone_numbers modify number varchar(132) NOT NULL UNIQUE',
    `CREATE TABLE permissions
    (
    permission_sid CHAR(36) NOT NULL UNIQUE ,
    name VARCHAR(32) NOT NULL UNIQUE ,
    description VARCHAR(255),
    PRIMARY KEY (permission_sid)
    )`,
    `CREATE TABLE user_permissions
    (
    user_permissions_sid CHAR(36) NOT NULL UNIQUE ,
    user_sid CHAR(36) NOT NULL,
    permission_sid CHAR(36) NOT NULL,
    PRIMARY KEY (user_permissions_sid)
    )`,
    `CREATE TABLE password_settings
    (
    min_password_length INTEGER NOT NULL DEFAULT 8,
    require_digit BOOLEAN NOT NULL DEFAULT false,
    require_special_character BOOLEAN NOT NULL DEFAULT false
    )`,
    'CREATE INDEX user_permissions_sid_idx ON user_permissions (user_permissions_sid)',
    'CREATE INDEX user_sid_idx ON user_permissions (user_sid)',
    'ALTER TABLE user_permissions ADD FOREIGN KEY user_sid_idxfk (user_sid) REFERENCES users (user_sid) ON DELETE CASCADE',
    'ALTER TABLE user_permissions ADD FOREIGN KEY permission_sid_idxfk (permission_sid) REFERENCES permissions (permission_sid)',
    'ALTER TABLE `users` ADD COLUMN `is_active` BOOLEAN NOT NULL default true',
  ],
  '8003': [
    'SET FOREIGN_KEY_CHECKS=0',
    'ALTER TABLE `voip_carriers` ADD COLUMN `register_status` VARCHAR(4096)',
    'ALTER TABLE `sbc_addresses` ADD COLUMN `last_updated` DATETIME',
    'ALTER TABLE `sbc_addresses` ADD COLUMN `tls_port` INTEGER',
    'ALTER TABLE `sbc_addresses` ADD COLUMN `wss_port` INTEGER',
    `CREATE TABLE system_information
    (
    domain_name VARCHAR(255),
    sip_domain_name VARCHAR(255),
    monitoring_domain_name VARCHAR(255)
    )`,
    'DROP TABLE IF EXISTS `lcr_routes`',
    'DROP TABLE IF EXISTS `lcr_carrier_set_entry`',
    `CREATE TABLE lcr_routes
    (
    lcr_route_sid CHAR(36),
    lcr_sid CHAR(36) NOT NULL,
    regex VARCHAR(32) NOT NULL COMMENT 'regex-based pattern match against dialed number, used for LCR routing of PSTN calls',
    description VARCHAR(1024),
    priority INTEGER NOT NULL COMMENT 'lower priority routes are attempted first',
    PRIMARY KEY (lcr_route_sid)
    )`,
    `CREATE TABLE lcr
    (
    lcr_sid CHAR(36) NOT NULL UNIQUE ,
    name VARCHAR(64) COMMENT 'User-assigned name for this LCR table',
    is_active BOOLEAN NOT NULL DEFAULT 1,
    default_carrier_set_entry_sid CHAR(36) COMMENT 'default carrier/route to use when no digit match based results are found.',
    service_provider_sid CHAR(36),
    account_sid CHAR(36),
    PRIMARY KEY (lcr_sid)
    )`,
    `CREATE TABLE lcr_carrier_set_entry
    (
    lcr_carrier_set_entry_sid CHAR(36),
    workload INTEGER NOT NULL DEFAULT 1 COMMENT 'represents a proportion of traffic to send through the associated carrier; can be used for load balancing traffic across carriers with a common priority for a destination',
    lcr_route_sid CHAR(36) NOT NULL,
    voip_carrier_sid CHAR(36) NOT NULL,
    priority INTEGER NOT NULL DEFAULT 0 COMMENT 'lower priority carriers are attempted first',
    PRIMARY KEY (lcr_carrier_set_entry_sid)
    )`,
    'CREATE INDEX lcr_sid_idx ON lcr_routes (lcr_sid)',
    'ALTER TABLE lcr_routes ADD FOREIGN KEY lcr_sid_idxfk (lcr_sid) REFERENCES lcr (lcr_sid)',
    'CREATE INDEX lcr_sid_idx ON lcr (lcr_sid)',
    'ALTER TABLE lcr ADD FOREIGN KEY default_carrier_set_entry_sid_idxfk (default_carrier_set_entry_sid) REFERENCES lcr_carrier_set_entry (lcr_carrier_set_entry_sid)',
    'CREATE INDEX service_provider_sid_idx ON lcr (service_provider_sid)',
    'CREATE INDEX account_sid_idx ON lcr (account_sid)',
    'ALTER TABLE lcr_carrier_set_entry ADD FOREIGN KEY lcr_route_sid_idxfk (lcr_route_sid) REFERENCES lcr_routes (lcr_route_sid)',
    'ALTER TABLE lcr_carrier_set_entry ADD FOREIGN KEY voip_carrier_sid_idxfk_3 (voip_carrier_sid) REFERENCES voip_carriers (voip_carrier_sid)',
    'SET FOREIGN_KEY_CHECKS=1',
  ],
  '8004': [
    'alter table accounts add column record_all_calls BOOLEAN NOT NULL DEFAULT false',
    'alter table accounts add column bucket_credential VARCHAR(8192)',
    'alter table accounts add column record_format VARCHAR(16) NOT NULL DEFAULT \'mp3\'',
    'alter table applications add column record_all_calls BOOLEAN NOT NULL DEFAULT false',
    'alter table phone_numbers DROP INDEX number',
    'create unique index phone_numbers_unique_idx_voip_carrier_number ON phone_numbers (number,voip_carrier_sid)',
    `CREATE TABLE clients
    (
    client_sid CHAR(36) NOT NULL UNIQUE ,
    account_sid CHAR(36) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT 1,
    username VARCHAR(64),
    password VARCHAR(1024),
    PRIMARY KEY (client_sid)
    )`,
    'CREATE INDEX client_sid_idx ON clients (client_sid)',
    'ALTER TABLE clients ADD CONSTRAINT account_sid_idxfk_13 FOREIGN KEY account_sid_idxfk_13 (account_sid) REFERENCES accounts (account_sid)',
    'ALTER TABLE sip_gateways ADD COLUMN protocol ENUM(\'udp\',\'tcp\',\'tls\', \'tls/srtp\') DEFAULT \'udp\''
  ],
  '8005': [
    'DROP INDEX speech_credentials_idx_1 ON speech_credentials',
    'ALTER TABLE speech_credentials ADD COLUMN label VARCHAR(64)',
    'ALTER TABLE applications ADD COLUMN speech_synthesis_label VARCHAR(64)',
    'ALTER TABLE applications ADD COLUMN speech_recognizer_label VARCHAR(64)',
    'ALTER TABLE applications ADD COLUMN use_for_fallback_speech BOOLEAN DEFAULT false',
    'ALTER TABLE applications ADD COLUMN fallback_speech_synthesis_vendor VARCHAR(64)',
    'ALTER TABLE applications ADD COLUMN fallback_speech_synthesis_language VARCHAR(12)',
    'ALTER TABLE applications ADD COLUMN fallback_speech_synthesis_voice VARCHAR(64)',
    'ALTER TABLE applications ADD COLUMN fallback_speech_synthesis_label VARCHAR(64)',
    'ALTER TABLE applications ADD COLUMN fallback_speech_recognizer_vendor VARCHAR(64)',
    'ALTER TABLE applications ADD COLUMN fallback_speech_recognizer_language VARCHAR(64)',
    'ALTER TABLE applications ADD COLUMN fallback_speech_recognizer_label VARCHAR(64)',
    'ALTER TABLE sip_gateways ADD COLUMN pad_crypto BOOLEAN NOT NULL DEFAULT 0',
    'ALTER TABLE sip_gateways MODIFY port INTEGER',
    `CREATE TABLE google_custom_voices
    (
    google_custom_voice_sid CHAR(36) NOT NULL UNIQUE ,
    speech_credential_sid CHAR(36) NOT NULL,
    model VARCHAR(512) NOT NULL,
    reported_usage ENUM('REPORTED_USAGE_UNSPECIFIED','REALTIME','OFFLINE') DEFAULT 'REALTIME',
    name VARCHAR(64) NOT NULL,
    PRIMARY KEY (google_custom_voice_sid)
    )
    `,
    'CREATE INDEX google_custom_voice_sid_idx ON google_custom_voices (google_custom_voice_sid)',
    'CREATE INDEX speech_credential_sid_idx ON google_custom_voices (speech_credential_sid)',
    'ALTER TABLE google_custom_voices ADD FOREIGN KEY speech_credential_sid_idxfk (speech_credential_sid) REFERENCES speech_credentials (speech_credential_sid) ON DELETE CASCADE',
    'ALTER TABLE clients ADD COLUMN allow_direct_queue_calling BOOLEAN NOT NULL DEFAULT 1',
    'ALTER TABLE clients ADD COLUMN allow_direct_user_calling BOOLEAN NOT NULL DEFAULT 1',
    'ALTER TABLE clients ADD COLUMN allow_direct_app_calling BOOLEAN NOT NULL DEFAULT 1',
  ],
  9000: [
    'ALTER TABLE sip_gateways ADD COLUMN send_options_ping BOOLEAN NOT NULL DEFAULT 0',
    'ALTER TABLE applications MODIFY COLUMN speech_synthesis_voice VARCHAR(256)',
    'ALTER TABLE applications MODIFY COLUMN fallback_speech_synthesis_voice VARCHAR(256)',
    'ALTER TABLE sip_gateways ADD COLUMN use_sips_scheme BOOLEAN NOT NULL DEFAULT 0',
  ],
  9002: [
    'ALTER TABLE system_information ADD COLUMN private_network_cidr VARCHAR(8192)',
    'ALTER TABLE system_information ADD COLUMN log_level ENUM(\'info\', \'debug\') NOT NULL DEFAULT \'info\'',
    'ALTER TABLE accounts ADD COLUMN enable_debug_log BOOLEAN NOT NULL DEFAULT false',
    'ALTER TABLE google_custom_voices ADD COLUMN use_voice_cloning_key BOOLEAN DEFAULT false',
    'ALTER TABLE google_custom_voices ADD COLUMN voice_cloning_key MEDIUMTEXT',
  ],
  9003: [
    'ALTER TABLE google_custom_voices ADD COLUMN voice_cloning_key MEDIUMTEXT',
    'ALTER TABLE google_custom_voices ADD COLUMN use_voice_cloning_key BOOLEAN DEFAULT false',
    'ALTER TABLE voip_carriers ADD COLUMN dtmf_type ENUM(\'rfc2833\',\'tones\',\'info\') NOT NULL DEFAULT \'rfc2833\'',
    'ALTER TABLE voip_carriers ADD COLUMN outbound_sip_proxy VARCHAR(255)',
  ],
  9004: [
    'ALTER TABLE applications ADD COLUMN env_vars TEXT',
  ],
  9005: [
    'UPDATE applications SET speech_synthesis_voice = \'en-US-Standard-C\' WHERE speech_synthesis_voice IS NULL AND speech_synthesis_vendor = \'google\' AND speech_synthesis_language = \'en-US\'',
    'ALTER TABLE applications MODIFY COLUMN speech_synthesis_voice VARCHAR(255) DEFAULT \'en-US-Standard-C\'',
    'ALTER TABLE voip_carriers ADD COLUMN trunk_type ENUM(\'static_ip\',\'auth\',\'reg\') NOT NULL DEFAULT \'static_ip\'',
  ]
};

const doIt = async() => {
  let connection;
  try {
    logger.info({opts}, 'connecting to mysql database..');
    connection = await mysql.createConnection(opts);
  } catch (err) {
    logger.error({err}, 'Error connecting to database with provided env vars');
    process.exit(1);
  }

  try {
    /* does the schema exist at all ? */
    const [r] = await connection.execute('SELECT version from schema_version');
    let errors = 0;
    if (r.length) {
      const {version} = r[0];
      const arr = /v?(\d+)\.(\d+)\.(\d+)/.exec(version);
      if (arr) {
        const upgrades = [];
        logger.info(`performing schema migration: ${version} => ${desiredVersion}`);
        const val = (1000 * arr[1]) + (100 * arr[2]) + arr[3];
        logger.info(`current schema value: ${val}`);

        if (val < 7006) upgrades.push(...sql['7006']);
        if (val < 7007) upgrades.push(...sql['7007']);
        if (val < 8000) upgrades.push(...sql['8000']);
        if (val < 8003) upgrades.push(...sql['8003']);
        if (val < 8004) upgrades.push(...sql['8004']);
        if (val < 8005) upgrades.push(...sql['8005']);
        if (val < 9000) upgrades.push(...sql['9000']);
        if (val < 9002) upgrades.push(...sql['9002']);
        if (val < 9003) upgrades.push(...sql['9003']);
        if (val < 9004) upgrades.push(...sql['9004']);
        if (val < 9005) upgrades.push(...sql['9005']);

        // perform all upgrades
        logger.info({upgrades}, 'applying schema upgrades..');
        for (const upgrade of upgrades) {
          try {
            await connection.execute(upgrade);
          } catch (err) {
            errors++;
            logger.info({statement:upgrade, err}, 'Error applying statement');
          }
        }
      }
      if (errors === 0) await connection.execute(`UPDATE schema_version SET version = '${desiredVersion}'`);
      await connection.end();
      logger.info(`schema migration to ${desiredVersion} completed with ${errors} errors`);
      return;
    }
  } catch (err) {
  }
  try {
    await createSchema(connection);
    await seedDatabase(connection);
    logger.info('reset admin password..');
    execSync(`${__dirname}/../db/reset_admin_password.js`);
    await connection.query(`INSERT into schema_version (version) values('${desiredVersion}')`);
    logger.info('database install/upgrade complete.');
    await connection.end();
  } catch (err) {
    logger.error({err}, 'Error seeding database');
    process.exit(1);
  }
};

const createSchema = async(connection) => {
  logger.info('reading schema..');
  const sql = await readFile(`${__dirname}/../db/jambones-sql.sql`, {encoding: 'utf8'});
  logger.info('creating schema..');
  await connection.query(sql);
};

const seedDatabase = async(connection) => {
  const sql = await readFile(`${__dirname}/../db/seed-production-database-open-source.sql`, {encoding: 'utf8'});
  logger.info('seeding data..');
  await connection.query(sql);
};


doIt();

