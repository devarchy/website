const assert = require('assert');
const ThingDB = require('../index.js');
const connection = require('../../connection.js');

module.exports = ({database_name, schema}) => {
    assert(database_name, schema);
    connection.database = database_name;
    const Thing = new ThingDB({
        connection,
        schema,
        http_max_delay: 1
    });
    assert(Thing.database);
    return Thing;
};
