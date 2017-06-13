"use strict";
const assert = require('better-assert');
const assert_hard = require('assert');
const assert_soft = require('assertion-soft');
const validator = require('validator');
const interpolate = require('../interpolate');
const Promise = require('bluebird');
const table_columns = require('./table').columns;
const map_props = require('./load/util').map_props;
const uuid = require('node-uuid');
Promise.longStackTraces();

module.exports = {
    save_event,
    save_thing,
};

function save_event(thing_id, thing_type, draft, {Thing, db_handle, transaction, schema__props, schema__interpolated_props}) {
    assert(Thing);
    assert(db_handle);
    assert(thing_id);
    assert(thing_type);
    assert(draft);
    assert_hard(Object.keys(draft).length>0);
    assert_hard(!draft.author || Object.keys(draft).length>1);
    assert( transaction === undefined || (transaction||{}).rid );
    assert_hard(!draft.history);

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
    assert(! thing_event_row.json_data.draft);
    Object.keys(thing_event_row.json_data).forEach(prop => {
        assert_hard(schema__props.includes(prop), prop);
        // it doesn't make sense to save interpolated properties in events
        assert_hard(!schema__interpolated_props.includes(prop));
    });

    let request = db_handle('thing_event');

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
            assert(schema__props.includes(prop));
        });

        new_thing_props.author = row.author;
        new_thing_props.type = row.type;

        return new_thing_props;
    });
}

function save_thing(thing, {Thing, db_handle, transaction, schema__not_user_generated_props}) {
    assert( Thing );
    assert( db_handle );
    assert( thing );
    assert( transaction === undefined || (transaction||{}).rid );

    const columns_insert = table_columns.thing_aggregate;

    const values = map_props.to_database(thing);

    assert( Object.keys(values).every(prop => columns_insert.includes(prop)) );

    assert( values.history );
    assert( values.history.constructor === Array );

    // stringify for json arrays required; https://github.com/brianc/node-postgres/issues/442
    values.history = JSON.stringify(values.history);

    assert_hard( values.json_data );
    assert_hard( Object.keys(values.json_data).every(prop => !schema__not_user_generated_props.includes(prop)) );
    assert_hard( Object.keys(values.json_data).every(prop => !columns_insert.includes(prop)) );
    assert_hard( Object.keys(values).every(prop => columns_insert.includes(prop)) );

    assert_hard( schema__not_user_generated_props.includes('updated_at') );
    assert_hard( ! values.json_data.updated_at );
    assert_hard( schema__not_user_generated_props.includes('subtype') );
    assert_hard( ! values.json_data.subtype );

    // knex doesn't translate undefined to null
    columns_insert.forEach(col => {
        if( values[col] === undefined ) {
            values[col] = null;
        }
    });

    let request =
        db_handle
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

    let req_str;
    try {
        req_str = request.toString();
    } catch(e) {
        console.error(JSON.stringify(values, null, 2));
        console.error('probably a property set to `undefined` somewhere in the JSON?');
        throw e;
    }
    Thing.debug.log.log(req_str, 'Transaction: '+(transaction||{}).rid);

    return (
        request
    )
    .catch(err => {
        assert_soft( !(
            (err||{}).code === '23505' && (err||{}).constraint === 'thing_aggregate_type_name_unique'
        ), err);
        throw err;
    });
}
