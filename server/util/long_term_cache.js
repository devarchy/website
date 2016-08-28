"use strict";
const assert = require('assert');
const knex_setup = require('knex');
const Promise = require('bluebird'); Promise.longStackTraces();
const env = require('../util/env');


module.exports = setup;
module.exports.close_connection = () => { if( knex ) knex.destroy() };


let knex;

function setup ({hash_input, cache_name, entry_expiration, function_to_cache, parse_output, ignore_cache_entry}) {
    const table_name = 'cache_'+cache_name;

    const database_setup = database_setup__factory();

    return (...args) => {
        const input_hashed = hash_input.apply(null, args);

        let function_to_cache__promise = null;

        const promise =
            Promise.resolve()
            .then(() =>
                database_setup()
            )
            .then(() =>
                get_cache_entry({input_hashed})
            )
            .catch(err => {
                setTimeout(() => {throw err},0);
            })
            .then(({output, output_is_error}) => {
                if( output ) {
                    if( ! ignore_cache_entry(output) ) {
                        output._comes_from_cache = true;
                        if( output_is_error ) {
                            throw output;
                        }
                        return output;
                    }
                }

                function_to_cache__promise = function_to_cache.apply(null, args);
                assert(((function_to_cache__promise||{}).then||0).constructor === Function);

                var output_is_error = false;

                return (
                    function_to_cache__promise
                )
                .catch(output => {
                    output_is_error = true;
                    return output;
                })
                .then(output =>
                    parse_output(output, output_is_error)
                )
                .then(output =>
                    set_cache_entry({input_hashed, output, output_is_error})
                    .then(() => output)
                )
                .catch(err => {
                    setTimeout(() => {throw err},0);
                })
                .then(output => {
                    if( output_is_error ) {
                        throw output;
                    }
                    return output;
                })
            });

        assert(function_to_cache__promise === null || function_to_cache__promise.then.constructor === Function);

        promise.abort = () => {
            if( function_to_cache__promise !== null ) {
                function_to_cache__promise.abort();
            }
        };

        return promise;
    };


    function get_cache_entry({input_hashed}) { 
        assert(entry_expiration && entry_expiration.constructor === Number);
        assert(input_hashed !== undefined);
        return (
            knex(table_name)
            .select("*")
            .where({input: input_hashed})
            .where('updated_at', '>', new Date(new Date() - entry_expiration))
        )
        .then(result => {
            var output, output_is_error;
            return {output, output_is_error} = ((result||[])[0]||{});
        });
    } 


    function set_cache_entry({input_hashed, output, output_is_error}) { 
        assert(input_hashed !== undefined);
        assert(output !== undefined );
        assert(output_is_error !== undefined);
        assert(input_hashed.constructor === String);
        assert(output.constructor === Object);
        assert(output_is_error.constructor === Boolean);
        try {
            // clean Object before passing it to knex otherwise knex may throw
            output = JSON.parse(JSON.stringify(output));
        }catch(e) {
            throw e;
        }
        const columns_to_insert = ['input','output', 'output_is_error', 'updated_at'];
        const columns_to_update = ['output', 'output_is_error', 'updated_at'];
        const column_primary_key = 'input';
        return (
            knex.raw(
                [
                    'INSERT INTO '+table_name+' (',
                        columns_to_insert.join(', '),
                    ')',
                    'VALUES (',
                        columns_to_insert.map(() => '?').join(', '),
                    ')',
                    'ON CONFLICT (',
                        column_primary_key,
                    ') DO',
                    'UPDATE SET (',
                        columns_to_update.join(', '),
                    ')',
                    '= (',
                        columns_to_update.map(col => 'EXCLUDED.'+col).join(', '),
                    ')',
                ].join(' '),
                [input_hashed, output, output_is_error, new Date(), ]
            )
        );
    } 

    function database_setup__factory() { 
        let setup_promise;

        return () => {
            if( ! setup_promise ) {
                setup_promise =
                    Promise.resolve()
                    .then(() =>
                        upsert_database()
                    )
                    .then(() =>
                        upsert_table()
                    )
            }
            return setup_promise;
        };

        function upsert_database() { 
            // - PostgreSQL doens't support `CREATE DATABASE IF NOT EXISTS db_name;`
            const database = 'devarchy__long_term_cache';

            knex = get_knex(database);
            return (
                knex.raw('select 1+1 as result')
            )
            .then(() => {})
            .catch(() => {
                // knex seems to require a database
                const database_temp = 'devarchy';
                const knex_temp = get_knex(database_temp);
                return (
                    knex_temp.raw('CREATE DATABASE "'+database+'";')
                    .then(() => {
                        knex_temp.destroy();
                        knex = get_knex(database);
                    })
                )
            });
        } 

        function upsert_table() { 
            return (
                knex
                .schema
                .hasTable(table_name)
                .then(function(exists) {
                    if (!exists) {
                        return knex.schema.createTable(table_name, function(table) {
                            table.string('input').primary();
                            table.timestamp('updated_at').notNullable();
                            table.boolean('output_is_error').notNullable();
                            table.jsonb('output');
                        });
                    }
                })
            )
        } 

        function get_knex(database) { 
            // knex seems to require a database
            assert(database);

            const config = {
                dialect: 'postgres',
                connection: {
                    host     : 'localhost',
                    port     : '5432',
                    user     : 'postgres',
                    password : env.POSTGRES_PASSWORD,
                    charset  : 'UTF8_GENERAL_CI'
                },
            };
            config.connection.database = database;

            return knex_setup(config);
        } 
    } 
}

