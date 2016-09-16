"use strict";
const assert = require('better-assert');
const validator = require('validator');
const connection = require('./connection');
const interpolate = require('../interpolate');
const Promise = require('bluebird');
const table_columns = require('./table').columns;
const map_props = require('./load/util').map_props;
const uuid = require('node-uuid');
Promise.longStackTraces();

module.exports = {
    event: save_event,
    thing: save_thing,
};

function save_event(thing_id, thing_type, draft, schema, transaction) {
    assert(thing_id);
    assert(thing_type);
    assert(draft);
    assert(schema);
    assert( transaction === undefined || (transaction||{}).rid );

    const Thing = require('../index.js');
    const knex = connection();

    const json_data = Object.assign({}, draft);

    const type = thing_type;

    const author = json_data.author;
    delete json_data.author;

    const thing_event_row = {
        id_row: uuid.v4(),
        id_thing: thing_id,
        type,
        author,
        json_data,
    };

    // we assert here because thing.validate() should always have previsouly been called by ThingDB library
    assert(thing_event_row.id_row);
    assert(thing_event_row.id_thing);
    assert(thing_event_row.type);
    assert(/^[a-z][a-z_]*[a-z]$/.test(thing_event_row.type));
    assert(thing_event_row.author);
    assert(thing_event_row.json_data);
    assert( Object.keys(thing_event_row).every(prop => table_columns.thing_event.includes(prop)) );

    assert(! thing_event_row.created_at);
    assert(! thing_event_row.json_data.id_row);
    assert(! thing_event_row.json_data.id_thing);
    assert(! thing_event_row.json_data.id);
    assert(! thing_event_row.json_data.type);
    assert(! thing_event_row.json_data.author);
    assert(! thing_event_row.json_data.updated_at);
    assert(! thing_event_row.json_data.created_at);
    assert(! thing_event_row.json_data.history);
    Object.keys(thing_event_row.json_data).forEach(prop => {
        // it doesn't make sense to save computed properties in events
        assert(prop==='removed' || schema[prop] && ! schema[prop].value);
    });

    let request = knex('thing_event');

    if( transaction ) {
        request = request.transacting(transaction);
    }
    request = request.insert([thing_event_row]);

    Thing.debug.log.log(request.toString(), 'Transaction: '+(transaction||{}).rid);

    return Promise.resolve(
        request.returning('*')
    )
    .then(rows => {

        assert(rows.length === 1);
        const row = rows[0];

        assert(row);
        assert(row.type);
        assert(/^[a-z][a-z_]*[a-z]$/.test(row.type));
        assert(row.author);
        assert(validator.isUUID(row.author));
        assert(row.json_data);

        const new_thing_props = Object.assign({}, row.json_data);

        Object.keys(new_thing_props).forEach(prop => {
            assert(prop==='removed' || !!schema[prop]);
        });

        new_thing_props.author = row.author;
        new_thing_props.type = row.type;

        return new_thing_props;
    });
}

function save_thing(thing, transaction) {
    assert( thing );
    assert( transaction === undefined || (transaction||{}).rid );

    const Thing = require('../index.js');
    const knex = connection();

    const columns_insert = table_columns.thing_aggregate;

    const values = map_props.to_database(thing);

    assert( Object.keys(values).every(prop => columns_insert.includes(prop)) );

    assert( values.history );
    assert( values.history.constructor === Array );

    // stringify for json arrays required; https://github.com/brianc/node-postgres/issues/442
    values.history = JSON.stringify(values.history);

    assert( values.json_data );
    assert( ! values.json_data.updated_at );
    const schema = thing.schema;
    assert( schema );
    assert( Object.keys(values).every(prop => columns_insert.includes(prop)) );

    // knex doesn't translate undefined to null
    columns_insert.forEach(col => {
        if( values[col] === undefined ) {
            values[col] = null;
        }
    });

    let request =
        knex
        .raw(
            [
                'INSERT INTO thing_aggregate (',
                    columns_insert.join(', '),
                ')',
                'VALUES (',
                    columns_insert.map(_ => '?').join(', '),
                ')',
                'ON CONFLICT (id_thing) DO',
                'UPDATE SET (',
                    columns_insert.join(', '),
                ')',
                '= (',
                    columns_insert.map(col => 'EXCLUDED.'+col).join(', '),
                ')',
            ].join(' '),
            columns_insert.map(col => values[col])
        );

    if( transaction ) {
        request = request.transacting(transaction);
    }

    Thing.debug.log.log(request.toString(), 'Transaction: '+(transaction||{}).rid);

    return (
        request
    )
    .catch(err => {
        assert( !(
            (err||{}).code === '23505' && (err||{}).constraint === 'thing_aggregate_type_name_unique'
        ));
        throw err;
    });
}
