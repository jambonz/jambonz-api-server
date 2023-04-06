#!/usr/bin/env node
/* eslint-disable max-len */
const assert = require('assert');
const mysql = require('mysql2/promise');
const {readFile} = require('fs/promises');
const {execSync} = require('child_process');
const {version:desiredVersion} = require('../package.json');
const logger = require('pino')();

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
  8003: [
    'ALTER TABLE `voip_carriers` ADD COLUMN `register_status` VARCHAR(4096)',
    'ALTER TABLE `sbc_addresses` ADD COLUMN `last_updated` DATETIME',
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

