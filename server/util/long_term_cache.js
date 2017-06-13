"use strict";
const assert = require('assert');
const assert_hard = require('assert');
const knex_setup = require('knex');
const Promise = require('bluebird'); Promise.longStackTraces();
const env = require('../util/env');
const turn_into_error_object = require('./turn_into_error_object');


module.exports = long_term_cache;
module.exports.close_connection = () => { if( knex ) return knex.destroy(); };


let knex;

function long_term_cache ({hash_input, cache_name, entry_expiration, function_to_cache}) {

    const table_name = 'cache_'+cache_name;

    const database_setup = database_setup__factory();

    return (...args) => {
        const {args__function, args__long_term_cache} = (() => { 
            const EXTRACTION_KEY = 'long_term_cache__args';
            const args__long_term_cache = {};
            const args__function = args;
            for(let i in args) {
                if( args[i] && args[i][EXTRACTION_KEY] ) {
                    assert_hard(args[i].constructor === Object, args);
                    Object.assign(args__long_term_cache, args[i][EXTRACTION_KEY]);
                    args[i] = Object.assign({}, args[i]);
                    delete args[i][EXTRACTION_KEY];
                }
            }
            return {args__function, args__long_term_cache};
        })(); 

        const input_hashed = hash_input.apply(null, args__function);

        let function_to_cache__promise = null;

        const promise =
            Promise.resolve()
            .then(() =>
                database_setup()
            )
            .then(() =>
                get_cache_entry({input_hashed, args__long_term_cache})
            )
            /*
            .catch(err => {
                setTimeout(() => {throw err},0);
            })
            */
            .then(({output, output_is_error}) => {
                const ignore_entry = !!output && !!ignore_cache_entry(output, output_is_error);
                /*
                console.log(
                    [
                        '',
                        '[cache][input] '+input_hashed,
                        '[cache][has-entry] '+!!output,
                    ]
                    .concat(!!output ? [
                        '[cache][ignore_entry] '+ignore_entry,
                        '[cache][entry-is-error] '+output_is_error,
                        '',
                    ] : [])
                    .concat([''])
                    .join('\n')
                );
                //*/
                if( output ) {
                    if( ! ignore_entry ) {
                        output._comes_from_cache = true;
                        if( output_is_error ) {
                            throw turn_into_error_object(output);
                            /* doesn't seem to work
                            const err = new Error('euwraaaaa');
                            err.name = JSON.stringify(output);
                            err.message = JSON.stringify(output);
                            throw turn_into_error_object(output, err);
                            */
                        }
                        return output;
                    }
                }

                function_to_cache__promise = function_to_cache.apply(null, args__function);
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
                    Promise.resolve()
                    .then(() => {
                        if( ignore_cache_entry(output, output_is_error) ) {
                            return;
                        }
                        return set_cache_entry({input_hashed, output, output_is_error});
                    })
                    .then(() => output)
                )
                /*
                .catch(err => {
                    setTimeout(() => {throw err},0);
                })
                */
                .then(output => {
                    if( output_is_error ) {
                        assert(output.stack, output);
                        throw output;
                    }
                    return output;
                })
            });

        assert(function_to_cache__promise === null || function_to_cache__promise.then.constructor === Function);

        return promise;
    };


    function get_cache_entry({input_hashed, args__long_term_cache}) { 
        let expiration = (
            args__long_term_cache.entry_expiration || entry_expiration
        );
        assert(expiration && expiration.constructor === Number);
     // expiration = 1000*60*60*24;
     // expiration = 1000*60*60*24*100;
        assert(input_hashed !== undefined);
     // const req_time = new Date();
        return (
            knex(table_name)
            .select("*")
            .where({input: input_hashed})
            .where('updated_at', '>', new Date(new Date() - expiration))
         // .whereRaw('false = true')
        )
        .then(result => {
            const {output, output_is_error} = ((result||[])[0]||{});
            /*
            if( new Date() - req_time > 300 ) {
                console.log('Slow cache retrival: ', (new Date() - req_time)+'ms', output?1:0, input_hashed);
            }
            */
            return {output, output_is_error};
        });
    } 


    function set_cache_entry({input_hashed, output, output_is_error}) { 
        assert(input_hashed !== undefined);
        assert(output !== undefined );
        assert(output_is_error !== undefined);
        assert(input_hashed.constructor === String);
        assert(output.constructor === Object);
        assert(output_is_error.constructor === Boolean);

        // don't save error object stuff
        assert(!output.propertyIsEnumerable('stack'));
        assert(!output.propertyIsEnumerable('name'));
        assert(!output.propertyIsEnumerable('message'));

        {
            let output_str;
            try {
                output_str = JSON.stringify(output);
            } catch(e) {
                console.log(output);
                console.log("Can't stringify");
                console.log(output_is_error);
                console.log(input_hashed);
                throw e;
            }
            try {
                output = JSON.parse(output_str);
            } catch(e) {
                console.log(output);
                console.log("Can't parse original");
                console.log(output_is_error);
                console.log(input_hashed);
                throw e;
            }
            output_str = output_str.replace(/[^\\]\\u0000/g, '');
            try {
                output = JSON.parse(output_str);
            } catch(e) {
                console.log(output);
                console.log("Can't parse modification");
                console.log(output_is_error);
                console.log(input_hashed);
                throw e;
            }
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
                            table.text('input').primary();
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
    function ignore_cache_entry(output, output_is_error) { 
        return (
            !!output_is_error
        );
    } 
}

