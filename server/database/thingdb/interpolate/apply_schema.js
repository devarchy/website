const assert = require('assert');
const Promise = require('bluebird'); Promise.longStackTraces();
const Promise_serial = require('promise-serial');
const database = require('../database');


module.exports = apply_schema;


function apply_schema(thing, transaction){
    assert(transaction && transaction.rid);
    return Promise_serial(
        thing.schema_ordered
        .map(prop_spec => {

            assert( prop_spec.property );

            if( !prop_spec.value || prop_spec.value.constructor !== Function )
                return () => Promise.resolve();

            return () => {

                const p = prop_spec.value(thing, transaction);

                if( ! (p||{}).then ) {
                    throw new Error('following schema value function should return a promise\n'+prop_spec.value);
                }

                return Promise.resolve(
                    p
                )
                .then(value => {
                    assert(value!==undefined);
                    assert(!((value||{}).constructor===Number && isNaN(value)), value);
                    assert(!prop_spec.required || value!==null, 'Property `'+prop_spec.property+'` is required but is computed to value `'+value+'` for thing of type `'+thing.type+'`');
                    if( value !== null ) {
                        thing[prop_spec.property] = value;
                    }
                })

            };

        })
    )

}
