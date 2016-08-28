const assert = require('assert');
const connection = require('../connection');
const Promise = require('bluebird');
Promise.longStackTraces();

module.exports = {
    delete_all,
    create_schema,
    columns: columns(),
    thingdb_schema_unique_constraints: thingdb_schema_unique_constraints(),
};

function delete_all() { 
    var knex = connection();

    return Promise.all([
        knex.raw('DROP TABLE IF EXISTS thing_event CASCADE'),
        knex.raw('DROP TABLE IF EXISTS thing_aggregate CASCADE'),
    ]);
} 

function create_schema() { 
    var knex = connection();

    return Promise.all([
        create_thing_event(),
        create_thing_aggregate(),
    ]);

    function create_thing_event(){
        return (
            knex.schema
            .createTable('thing_event', function(table) {
                table.uuid('id_row').primary();
                table.uuid('id_thing').notNullable();
                table.string('type').notNullable();
                table.string('author').notNullable();
                table.timestamp('created_at').unique().notNullable().defaultTo(knex.raw('now()'));
                table.jsonb('json_data').notNullable();
            })
        );
    }

    function create_thing_aggregate(){

        const Thing = require('../../index.js');

        const request = (
            knex.schema
            .createTable('thing_aggregate', function(table) {

                table.uuid('id_thing').primary();
                table.string('type').notNullable();
                // should be an array `authors`
                table.string('author').notNullable();
                table.boolean('removed').notNullable();
                table.jsonb('history').notNullable();
                table.jsonb('json_data').notNullable();
                table.timestamp('created_at').notNullable();
                table.timestamp('updated_at').notNullable();
                table.timestamp('computed_at').notNullable();

            })
        );

        Thing.debug.log.log(request.toString());

        return (
            request
        ).then( () =>
            knex.schema.raw('alter table thing_aggregate add column "views" text[];')
        ).then( () =>
            knex.schema.table('thing_aggregate', table =>
                table.index(['views'])
            )
        );

    }
} 

function columns(){ 
    const columns = {
        thing_event: [
            'id_row',
            'id_thing',
            'type',
            'author',
            'created_at',
            'json_data',
        ],
        thing_aggregate: [
            'id_thing',
            'type',
            'author',
            'removed',
            'history',
            'json_data',
            'created_at',
            'updated_at',
            'computed_at',
            'views',
        ],
    };

    columns.both =
        Array.from(new Set(
            [].concat(
                columns.thing_aggregate
            )
            .concat(
                columns.thing_event
            )
        ));

    return columns;
} 

function thingdb_schema_unique_constraints() { 
    const constraints = {};

    return {
        constraints,
        apply,
    };

    function apply() {
        const Thing = require('../../');
        const knex = connection();

        const INDEX_NAME_PREFIX = 'unique__';

        assert(Thing.schema && Thing.schema.constructor === Object);

        Object.entries(Thing.schema).forEach(([type, type_schema]) => {
            Object.entries(type_schema).forEach(([prop_name, {is_unique}]) => {
                if( ! is_unique ) {
                    return;
                }

                const OPT_PROPS = '_options';

                assert( prop_name === OPT_PROPS && is_unique.constructor === Array || is_unique.constructor === Boolean );

                const tuple = prop_name === OPT_PROPS ? is_unique : [prop_name];

                const index_name = INDEX_NAME_PREFIX+["type_"+type].concat(tuple).join('__');

                // postgres truncates names with length > 63;
                assert(index_name.length <= 63);

                const request = [
                    'ALTER TABLE',
                    'thing_aggregate',
                    'ADD CONSTRAINT',
                    index_name,
                    'EXCLUDE',
                    "(",
                        tuple.map(col_name =>
                            [
                                columns().thing_aggregate.includes(col_name) ?  col_name : "(json_data->'"+col_name+"')",
                                "WITH =",
                            ].join(' ')
                        ).join(", "),
                    ")",
                    "WHERE (type='"+type+"')",
                    "DEFERRABLE INITIALLY DEFERRED",
                ].join(' ')+";";

                constraints[index_name] = {
                    type,
                    request,
                    tuple,
                };
            });
        });

        return (
            knex.raw("SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND indexname ~ '^"+INDEX_NAME_PREFIX+".*';")
        )
        .then(({rows}) => {
            rows.forEach(({indexdef}) => {
                assert(indexdef);
                assert(indexdef.startsWith('CREATE INDEX '+INDEX_NAME_PREFIX));
                assert(indexdef.includes('ON thing_aggregate'));
            });

            const unique_indices__already_created = {};
            const requests_to_run = [];
            rows.forEach(({indexname}) => {
                unique_indices__already_created[indexname] = true;
                if( ! constraints[indexname] ) {
                    requests_to_run.push('ALTER TABLE thing_aggregate DROP CONSTRAINT '+indexname+';');
                }
            });
            Object.entries(constraints).forEach(([indexname, {request}]) => {
                if( ! unique_indices__already_created[indexname] ) {
                    requests_to_run.push(request);
                }
            });
            assert(requests_to_run.length + rows.length >= Object.keys(constraints).length);
            return requests_to_run;
        })
        .then(requests_to_run =>
            Promise.all(requests_to_run.map(request => knex.schema.raw(request)))
        );
    }
} 
