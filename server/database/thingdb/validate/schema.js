"use strict";
const assert = require('assert');

module.exports = ({Thing}) => {
    assert(Thing);
    assert(Thing.database);
    validate_coarse({Thing});
    walk_on_schema({Thing});
};


function validate_coarse({Thing}) {
    if( ! Thing.schema ) {
        throw new Thing.SchemaError('Thing.schema should be an object');
    }
    if( Object.keys(Thing.schema).length === 0 ) {
        throw new Thing.SchemaError('Thing.schema is empty');
    }
}

function walk_on_schema({Thing}) {
    Object
    .entries(Thing.schema)
    .forEach(keyval => {
        const thing_type = keyval[0];
        const thing_spec = keyval[1];

        validate_thing(thing_type, thing_spec);

        Object
        .entries(thing_spec)
        .forEach(keyval => {
            const prop_name = keyval[0];
            const prop_spec = keyval[1];

            if(prop_name === '_options') {
                validate_options(prop_spec, thing_spec);
            }
            else {
                validate_prop(prop_name, prop_spec);
            }
        });
    });
}

function validate_thing(type, spec) {
    if( type.startsWith('_') && type!=='_options' ) {
        throw new Thing.SchemaError('found type `'+type+'` but only `_options` is allowed to start with `_`');
    }
    if( ! /^[a-z][a-z_]*[a-z]$/.test(type) ) {
        throw new Thing.SchemaError('found type `'+type+'` but type name should be composed of lowercase letters and _');
    }
}

function validate_prop(name, spec) {
    is_subset(Object.keys(spec), [
        'validation',
        'order',
        'is_required',
        'required_props',
        'value',
        'add_to_view',
        'cascade_save',
        'immutable',
        'is_unique',
        'is_async',
        // 'allow_multiple_authors', // TODO
    ]);

    if( name.includes('.') ) {
        throw new Thing.SchemaError('Property name `'+name+'` contains `.` which is not allowed');
    }

    if( ! spec.validation ) {
        throw new Thing.SchemaError('validation is missing for '+name);
    }

    if( ! spec.validation.type ) {
        throw new Thing.SchemaError('validation.type is missing for '+name);
    }

    if( spec.value !== undefined && spec.value.constructor !== Function ) {
        throw new Thing.SchemaError('value is expected to be a Function');
    }

    if( ['add_to_view', 'value'].every(req => Object.keys(spec).includes(req)) ) {
        throw new Thing.SchemaError("Having a thing that is part of a view of referred thing in a computed property is not supported");
    }

    if( spec.cascade_save ) {
        const types = spec.validation.type.constructor === Array ? spec.validation.type : [spec.validation.type];
        if( types.some(type => ! type.startsWith('Thing.')) ) {
            throw new Thing.SchemaError('`cascade_save` only make sense for referred things');
        }
    }
}

function validate_options(spec, thing_spec) {
    const keys = Object.keys(spec);

    if( keys.length === 0 ) throw new Thing.SchemaError('empty options found');

    is_subset(keys, [
        'additional_views',
        'is_unique',
        'side_effects',
        'is_private',
        'is_required',
    ]);

    if( spec.is_required ) {
        if( ! ((spec.is_required||[]).length>0) ) {
            throw new Thing.SchemaError('`_options.is_required` should be a non-empty Array');
        }
        spec.is_required.forEach(prop => {
            if( ! thing_spec[prop] ) {
                throw new Thing.SchemaError('`_options.is_required` includes `'+prop+'` but it is not defined in the schema');
            }
        });
    }
}

function is_subset(arr_subset, arr) {
    arr_subset.forEach(el => {
        if( ! arr.includes(el) ) {
            throw new Thing.SchemaError('unknown `'+el+'` found');
        }
    });
}
