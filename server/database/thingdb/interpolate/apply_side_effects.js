const assert = require('assert');
const assert_soft = require('assertion-soft');
const Promise = require('bluebird'); Promise.longStackTraces();
const Promise_serial = require('promise-serial');


module.exports = apply_side_effects;


function apply_side_effects(thing, {Thing, schema__options, transaction, schema__args, is_within_transaction}) {
    assert( Thing );
    assert( Thing.database );
    assert(schema__args && schema__args.constructor===Object);
    assert( [true, false].includes(is_within_transaction) );

    const se_args = {Thing, schema__args};

    assert_soft(!!is_within_transaction===!!transaction);
    if( is_within_transaction ) {
        se_args.transaction = transaction;
    }

    const side_effect_promises =
        (schema__options.side_effects||[])
        .filter(se => se.apply_outside_transaction!==is_within_transaction)
        .map(se => se.side_effect_computation(thing, Object.assign({}, se_args)))
        .filter(side_effect => side_effect!==null);
    assert(side_effect_promises.every(side_effect => (side_effect||0).constructor === Function));

    // - wihtin transaction side effects are not implemented
    //   - ain't trivial: How do you rollback something in the side effect?
    assert_soft(!(is_within_transaction===true && side_effect_promises.length>0));

    return Promise_serial(side_effect_promises);
}
