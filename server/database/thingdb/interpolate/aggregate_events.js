"use strict";
const Promise = require('bluebird');
Promise.longStackTraces();
const database = require('../database');
const assert = require('assert');


module.exports = function (thing, {Thing, is_insert, transaction, dont_validate_current_saved_things}){
    assert( Thing )
    assert( Thing.db_handle )
    assert( thing );
    assert( thing.constructor === Thing );
    assert( [true, false].includes(is_insert) );
    assert( transaction );
    assert( Object.keys(thing.draft).length === 0 );

    return Promise.resolve()
    .then(() =>
        database.load.events({id: thing.id}, {Thing, transaction, orderBy: 'created_at'})
    )
    .then(events => {
        assert( events );
        assert( events.constructor === Array );
        assert( is_insert ? (events.length === 1) : (events.length >= 1) );
        assert( events.every((e, i) => i===events.length-1 || e.created_at < events[i+1].created_at) );

        const thing_data = (() => {
            const thing_data = Object.assign({}, thing);
            Object.keys(thing_data).forEach(prop => {
                if( (thing.schema[prop]||{}).value ) {
                    delete thing_data[prop];
                }
            });
            return thing_data;
        })();

        if( thing.history ) {
            if( !dont_validate_current_saved_things ) {
                // - thing props come from database
                // - we ignore author because the author set on thing is the first one and not the last one
                assert(
                    is_subset(
                        Object.assign({}, events.slice(-1)[0]),
                        thing_data,
                        ['created_at', 'author']
                    ),
                    [
                        '\n',
                        JSON.stringify(events.slice(-1)[0], null, 2),
                        '\nis not a subset of\n',
                        JSON.stringify(thing, null, 2),
                    ].join('')
                );
            }
        }
        else {
            // thing props come from user
            const event = events.slice(-1)[0];
            assert( !thing.created_at );
            assert(
                deep_equal(event, thing_data, ['created_at', 'author']),
                [
                    '\n',
                    JSON.stringify(event, null, 2),
                    '\nis not equivalent to\n',
                    JSON.stringify(thing_data, null, 2),
                ].join('')
            );
        }

        for(let prop in thing) delete thing[prop];

        // build history array
        thing.history =
            events.map(ev => {
                const ret = {};
                for(var prop in ev) {
                    if( ! database.table.columns.thing_event.concat('id').includes(prop) || ['author', 'created_at'].includes(prop) ) {
                        ret[prop] = ev[prop];
                    }
                }
                return ret;
            });

        // defaulty set removed to false, i.e. don't force ThingDB user to set removed
        thing.removed = false;

        // aggregate event properties to thing properties
        events.forEach(ev => {
            Object.entries(ev)
            .forEach(keyval => {
                const prop = keyval[0];
                const val = keyval[1];
                if( prop !== 'created_at' ) {
                    thing[prop] = val;
                }
            });
        });

        thing.updated_at = events.slice(-1)[0].created_at;
        thing.created_at = events[0].created_at;
        thing.computed_at = new Date();
        assert(thing.updated_at.constructor === Date);
        assert(thing.created_at.constructor === Date);

        assert( events.every(ev => Object.keys(ev).every(prop => ['id', 'type', 'author', 'removed', 'created_at', ].includes(prop) || thing.schema[prop]) ) );

        assert(
            deep_equal(Object.assign({}, thing), thing_data, ['history', 'computed_at', 'created_at', 'updated_at', 'removed']),
            [
                '\n',
                JSON.stringify(thing, null, 2),
                '\nis not equivalent to\n',
                JSON.stringify(thing_data, null, 2),
            ].join('')
        );
    });
};


function deep_equal(a, b, keys_to_ignore=[]) {
    assert([a, b].every(v => [null, undefined].includes(v) || [Object, Array, Number, String, Boolean].includes(v.constructor)), a);
    if( [a, b].every(o => (o||0).constructor === Object) ) {
        if( ! same_content(Object.keys(a), Object.keys(b), keys_to_ignore) )
            return false;
        for(let i in b) if( ! keys_to_ignore.includes(i) && ! deep_equal(a[i], b[i]) ) return false;
        return true;
    }
    return a === b;

    function same_content(arr1, arr2, elements_to_ignore) {
        return (
            arr1.every(e => elements_to_ignore.includes(e) || arr2.includes(e)) &&
            arr2.every(e => elements_to_ignore.includes(e) || arr1.includes(e))
        );
    }
}

function is_subset(a, b, keys_to_ignore=[]) {
    if( [a, b].every(o => (o||0).constructor === Object) ) {
        for(let i in a) if( ! keys_to_ignore.includes(i) && ! is_subset(a[i], b[i]) ) return false;
        return true;
    }
    return [b, undefined].includes(a);
}
