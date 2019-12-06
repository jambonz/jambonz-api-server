# jambones-api-server [![Build Status](https://secure.travis-ci.org/jambonz/jambones-api-server.png)](http://travis-ci.org/jambonz/jambones-api-server)

Jambones REST API server.

## Configuration

The configuration needs of the application are minimal and can be found in the `config` directory (using the npmjs [config](https://www.npmjs.com/package/config) package). You simply need to configure the connection settings to the mysql database and the log level.  Copy the provided [default.json.example](config/default.json.example) to default.json or local.json and edit appropriately.

#### Database dependency
A mysql database is used to store long-lived objects such as Accounts, Applications, etc. To create the database schema, use or review the scripts in the 'db' folder, particularly:
- [create_db.sql](db/create_db.sql), which creates the database and associated user (you may want to edit the username and password),
- [jambones-sql.sql](db/jambones-sql.sql), which creates the schema,
- [create-admin-token.sql](db/create-admin-token.sql), which creates an admin-level auth token that can be used for testing/exercising the API.

> Note: due to the dependency on the npmjs [mysql](https://www.npmjs.com/package/mysql) package, the mysql database must be configured to use sql [native authentication](https://medium.com/@crmcmullen/how-to-run-mysql-8-0-with-native-password-authentication-502de5bac661).

#### Running the app
At this point, if you have followed the above instructions, its simply
```
npm install
node app
```
The server will listen by default on port 3000, to change this set the HTTP_PORT environment variable:
```
HTTP_PORT=4000 node app
```

#### Running the test suite
To run the included test suite, you will need to have a mysql server installed on your laptop/server. You will need to set the MYSQL_ROOT_PASSWORD env variable to the mysql root password before running the tests.  The test suite creates a database named 'jambones_test' in your mysql server to run the tests against, and removes it when done.
```
export MYSQL_ROOT_PASSWORD=foobar
npm test
```
