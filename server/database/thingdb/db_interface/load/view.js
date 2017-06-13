"use strict";
const Promise = require('bluebird');
Promise.longStackTraces();
const assert = require('better-assert');
const load_things = require('./things');
const util = require('./util');


module.exports = load_view;

function load_view(things_props, {Thing, db_handle, transaction, show_removed_things=false}={}) {
    assert( things_props );
    assert( things_props.constructor === Array )
    assert( things_props.length !== 0 );
    assert( things_props.every(thing_props => thing_props.constructor === Object) );
    assert( transaction === undefined || (transaction||{}).rid );
    assert( [true, false].includes(show_removed_things) );

    var request = db_handle('thing_aggregate');

    if( transaction ) {
        request = request.transacting(transaction);
    }

    request = request.select('*');

    if( !show_removed_things ) {
        request =
            request
            .where({is_removed: false});
    }

    request =
        request
        .where(db_handle.raw('id_thing::text'), 'in', function(){

            let sub_request = this.table('thing_aggregate');

            if( transaction ) {
                sub_request = sub_request.transacting(transaction);
            }

            sub_request =
                sub_request
                .select(db_handle.raw('unnest(views)'))

            if( !show_removed_things ) {
                sub_request =
                    sub_request
                    .where({is_removed: false});
            }

            things_props.forEach(thing_props => {
                sub_request =
                    sub_request
                    .where('views', '&&', db_handle.raw(
                        load_things(thing_props, {result_fields: ['id'], Thing, db_handle, transaction, return_raw_request: true})
                    ).wrap('array(',')::text[]'))
            });

        });

    Thing.debug.log.log(request.toString(), 'Transaction: '+(transaction||{}).rid);

    return Promise.resolve(
        request
    )
    .then(things =>
        things.map(props_from_database => util.map_props.to_thing(props_from_database))
    );
}


