#!/usr/bin/env node
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

const doIt = async () => {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.JAMBONES_MYSQL_HOST,
      user: process.env.JAMBONES_MYSQL_USER,
      password: process.env.JAMBONES_MYSQL_PASSWORD,
      database: process.env.JAMBONES_MYSQL_DATABASE,
      port: process.env.JAMBONES_MYSQL_PORT || 3306,
      multipleStatements: true
    });
  } catch (err) {
    logger.error({err}, 'Error connecting to database with provided env vars');
    return;
  }

  try {
    /* does the schema exist at all ? */
    const [r] = await connection.execute('SELECT version from schema_version');
    if (r.length) {
      //TODO: check against desired version and perform upgrades
      logger.info(`current version is ${r[0].version}, no upgrade will be performed`);
      await connection.end();
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

