const ThingDB = require('./thingdb');
const connection = require('./connection');
const schema = require('./schema');

const Thing = new ThingDB({
    connection,
    schema,
});

module.exports = Thing;
