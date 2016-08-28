"use strict";
const Promise = require('bluebird');
Promise.longStackTraces();
const connection = require('../connection');
const assert = require('better-assert');
const load_things = require('./things');
const util = require('./util');


module.exports = view;

function view(things_props, {transaction}={}) {
    assert( things_props );
    assert( things_props.constructor === Array )
    assert( things_props.length !== 0 );
    assert( things_props.every(thing_props => thing_props.constructor === Object) );
    assert( transaction === undefined || (transaction||{}).rid );

    const Thing = require('../../index.js');

    const knex = connection();

    var request = knex('thing_aggregate');

    if( transaction ) {
        request = request.transacting(transaction);
    }

    request =
        request.select('*')
        .where({removed: false})
        .where(knex.raw('id_thing::text'), 'in', function(){

            let sub_request = this.table('thing_aggregate');

            if( transaction ) {
                sub_request = sub_request.transacting(transaction);
            }

            sub_request =
                sub_request
                .select(knex.raw('unnest(views)'))
                .where({removed: false});

            things_props.forEach(thing_props => {
                sub_request =
                    sub_request
                    .where('views', '&&', knex.raw(
                        load_things(thing_props, {result_fields: ['id'], transaction, return_raw_request: true})
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


