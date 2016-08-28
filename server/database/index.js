const Thing = require('./thingdb');
const connection = require('./connection');
const schema = require('./schema');

Thing.database.connection = connection;
Thing.schema = schema;

module.exports = Thing;
