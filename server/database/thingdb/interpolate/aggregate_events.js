"use strict";
const Promise = require('bluebird');
Promise.longStackTraces();
const db_interface = require('../db_interface');
const assert_soft = require('assertion-soft');
const assert = require('assertion-soft');
const schema_common = require('../schema_common').thing;
const deep_equal = require('../util/deep-equal');


module.exports = function (thing, {Thing, db_handle, transaction, dont_validate_current_saved_things, schema__props, schema__interpolated_props, schema__props_graveyard}){
    assert( Thing )
    assert( db_handle )
    assert( thing );
    assert( thing.constructor === Thing );
    assert( transaction );
    assert( Object.keys(thing.draft).length === 0 );

 // schema__interpolated_props = [...schema__interpolated_props, 'views'];

    return Promise.resolve()
    .then(() =>
        db_interface.load_events({id: thing.id}, {Thing, transaction, orderBy: 'created_at', db_handle})
    )
    .then(events => {
        assert( events );
        assert( events.constructor === Array );
        events.forEach((e, i) => {
            Object.keys(e).forEach(prop => {
                assert_soft(schema__props.includes(prop) || schema__props_graveyard.includes(prop), thing, prop);
            })
            assert( e.created_at.constructor===Date );
            if( i!==events.length-1 ) {
                const e1 = e.created_at.getTime();
                const e2 = events[i+1].created_at.getTime();
                try {
                    // - this can happen because pg's date format is more precise than js's date format
                    //   - https://github.com/brianc/node-postgres/issues/107#issuecomment-7239948
                    // - I believe created_at unique constraint is not DEFERRED
                    assert( e1 !== e2 );
                    assert( e1 < e2 );
                } catch(e) {
                    console.log(JSON.stringify(events[i], null, 2));
                    console.log(JSON.stringify(events[i+1], null, 2));
                    throw e;
                }
            }
        });

        const thing_props = Object.assign({}, thing);

        const event__last = events.slice(-1)[0];
        const event__first = events[0];

        if( thing.history ) { // thing props come from database
            if( !dont_validate_current_saved_things ) {
                assert_soft(
                    is_subset(
                        Object.assign({}, event__last),
                        thing_props,
                        [
                            'created_at',
                            // we ignore author because the author set on thing is the first one and not the last one
                            'author',
                            ...schema__interpolated_props,
                        ]
                    ),
                    [
                        '\n',
                        JSON.stringify(events.slice(-1)[0], null, 2),
                        '\nis not a subset of\n',
                        JSON.stringify(thing_props, null, 2),
                    ].join('')
                );
            }
        }
        else { // thing props come from user
            assert_soft( !thing.created_at );
            const keys_to_ignore = [
                'created_at',
                'author',
                ...schema__interpolated_props
            ];
            assert_soft(
                deep_equal(
                    event__last,
                    thing_props,
                    keys_to_ignore
                ),
                [
                    '\n',
                    JSON.stringify(event__last, null, 2),
                    '\nis not equivalent to\n',
                    JSON.stringify(thing_props, null, 2),
                    '\nIgnored keys: '+JSON.stringify(keys_to_ignore),
                ].join('')
            );
        }

        const new_props = {
            history: build_history(events, schema__props_graveyard),
            created_at: event__first.created_at,
            author: event__first.author,
            updated_at: event__last.created_at,
            computed_at: new Date(),
        };

        const side_props = Object.keys(new_props);

        // aggregate event properties to thing properties
        events.forEach(ev => {
            Object.entries(ev)
            .forEach(([prop, val]) => {
                if( ['created_at', 'author', ].includes(prop) ) return;
                if( schema__props_graveyard.includes(prop) ) return;
                assert(!side_props.includes(prop));
                new_props[prop] = val;
            });
        });

        if( !dont_validate_current_saved_things ) {
            const keys_to_ignore = [
                ...side_props,
                ...schema__interpolated_props,
            ];
            assert_soft(
                deep_equal(
                    new_props,
                    Object.assign({}, thing),
                    keys_to_ignore
                ),
                [
                    '\n',
                    JSON.stringify(new_props, null, 2),
                    '\nis not equivalent to\n',
                    JSON.stringify(thing, null, 2),
                    '\nIgnored keys: '+JSON.stringify(keys_to_ignore),
                ].join('')
            );
        }

        for(let prop in thing) {
            if( schema__interpolated_props.includes(prop) ) {
                continue;
            }
            if( (prop in new_props) ) {
                continue;
            }
            if( !dont_validate_current_saved_things ) {
                assert_soft(false, 'unexpected losing of '+prop);
            }
            delete thing[prop];
        }
        Object.assign(thing, new_props);

    });
};

function build_history(events, schema__props_graveyard) {
    const history = events.map(ev => {
        const ret = {};
        for(var prop in ev) {
            if( schema__props_graveyard.includes(prop) ) continue;
            if( ! db_interface.table.columns.thing_event.concat('id').includes(prop) || ['author', 'created_at'].includes(prop) ) {
                ret[prop] = ev[prop];
            }
        }
        return ret;
    });
    return history;
}

function is_subset(a, b, keys_to_ignore=[]) {
    if( [a, b].every(o => (o||0).constructor === Object) ) {
        for(let i in a) if( ! keys_to_ignore.includes(i) && ! is_subset(a[i], b[i]) ) return false;
        return true;
    }
    if( a === undefined ) {
        return true;
    }
    if( [a, b].every(o => (o||0).constructor === Array) ) {
        return deep_equal(a, b);
    }
    return a === b;
}
