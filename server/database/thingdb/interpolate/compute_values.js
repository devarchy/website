const assert = require('assert');
const Promise = require('bluebird'); Promise.longStackTraces();
const Promise_serial = require('promise-serial');


module.exports = compute_values;


function compute_values(thing, {Thing, transaction, only_sync, required_props_may_be_missing}) {
    assert( Thing );
    assert( Thing.database );
    assert( Thing.SchemaError );

    assert(!!((transaction||{}).rid) !== !!only_sync);

    const props_to_compute =
        thing.schema_ordered
        .filter(prop_spec => {
            assert( prop_spec.property );

            if( !prop_spec.value ) {
                return false;
            }
            assert(prop_spec.value.constructor === Function);

            if( only_sync && prop_spec.is_async ) {
                return false;
            }

            return true;
        });

    if( only_sync ) {
        props_to_compute.forEach(prop_spec => {
            const val = compute({prop_spec});
            validate_returned_obj(prop_spec, val);
            set_value({prop_spec, val});
        });
        return;
    }

    assert(Object.keys(thing.draft).length===0);

    return Promise_serial(
        props_to_compute.map(prop_spec => () => {
                const promise = compute({prop_spec, transaction});

                validate_returned_obj(prop_spec, promise);

                return (
                    Promise.resolve(promise)
                )
                .then(val =>
                    set_value({prop_spec, val})
                )
                .then(() => {});
            }
        )
    );

    function set_value({prop_spec, val}) {
        validate_value({prop_spec, val});
        if( val !== null ) {
            thing[prop_spec.property] = val;
        }
    }

    function validate_returned_obj(prop_spec, obj) {
        const is_promise = (obj||{}).then;
        if( prop_spec.is_async && ! is_promise ) {
            throw new Thing.SchemaError("following schema value function is set with `is_async=="+prop_spec.is_async+"` and should return a promise\n"+prop_spec.value);
        }
        if( ! prop_spec.is_async && is_promise ) {
            throw new Thing.SchemaError("following schema value function is set with `is_async=="+prop_spec.is_async+"` and shouldn't return a promise\n"+prop_spec.value);
        }

    }

    function validate_value({prop_spec, val}) {
        if( val===undefined || (val||{}).constructor===Number && isNaN(val) ) {
            throw new Thing.SchemaError('Property `'+prop_spec.property+'` is computed to value `'+val+'`, return `null` instead');
        }
        if( prop_spec.is_required && val===null ) {
            throw new Thing.SchemaError('Property `'+prop_spec.property+'` is required but is computed to value `'+val+'` for thing of type `'+thing.type+'`');
        }
    }

    function compute({prop_spec, transaction}) {
        if( required_props_may_be_missing ) {
            try {
                return doit();
            } catch(e) {
                return null;
            }
        }

        return doit();

        function doit() {
            return prop_spec.value(Object.assign({}, thing, thing.draft), {Thing, transaction});
        }
    }
}

