const assert = require('assert');
const assert_soft = require('assertion-soft');
const knex_module = require('knex');
const conn = require('../database/connection');


module.exports = ensure_database_connection;


// - PostgreSQL doens't support `CREATE DATABASE IF NOT EXISTS db_name;`
// - PostgreSQL seems to require a connection to a database
function ensure_database_connection(connection) {
    assert(connection);
    assert(connection.database);

    const database_name = connection.database;

    let handle = get_handle(database_name);
    let database_newly_created = false;

    return (
        handle.raw('select 1+1 as result')
        .catch(err => {
            if( err.code !== '3D000' ) {
                throw err;
            };
            assert_soft(err.toString().includes('database "'+database_name+'" does not exist'));

            database_newly_created = true;

            const temporary_handle = get_handle();

            return (
                temporary_handle
                .raw('CREATE DATABASE "'+database_name+'"')
                .then(() => {
                    temporary_handle.destroy();
                    handle = get_handle(database_name);
                })
            )
        })
        .then(() => {
            assert(handle);
            assert(handle.raw);
            return {handle, database_newly_created};
        })
    )

    function get_handle(database_name='postgres') {
        const conn = Object.assign({}, connection);
        delete conn.database;
        conn.database = database_name;
        return (
            knex_module({
                dialect: 'postgres',
                connection: conn,
            })
        );
    }
}
