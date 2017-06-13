const assert = require('assert');
const ThingDB = require('../index.js');
const conn = require('../../connection.js');

module.exports = ({database_name, schema}) => {
    assert(database_name, schema);
    const connection = Object.assign({}, conn, {database: database_name});
    const Thing = new ThingDB({
        connection,
        schema,
        http_max_delay: 1,
        dont_throw_on_connection_errors: true,
        schema__args: {
            is_a_test_run: true,
        },
    });
    assert(Thing.database);
    return Thing;
};
