"use strict";
const assert = require('assert');
const schema_common = require('../schema_common');

module.exports = ({Thing, type, schema_, schema__options}) => {
    assert(Thing);
    assert(Thing.database);
    assert(type);

    validate_type_name({type, Thing});
    validate_schema_existence({Thing, schema_, type});
    validate_schema_props({Thing, schema_});
    validate_schema_options({Thing, type, schema_, schema__options});
};


function validate_schema_props({Thing, schema_}) { 
    Object
    .entries(schema_)
    .forEach(([prop_name, prop_spec]) => {
        validate_prop(prop_name, prop_spec, {Thing});
    });

    return;
} 

function validate_prop(name, spec, {Thing}) { 
    if( name.startsWith('_') ) {
        throw new Thing.SchemaError('property `'+name+'` is not allowed to start with `_`');
    }

    is_subset(Object.keys(spec), [
        'validation',
        'compute_order',
        'is_required',
        'required_props',
        'value',
        'add_to_view',
        'cascade_save',
        'immutable',
        'is_unique',
        'is_async',
        'default_value',
        ...(
            schema_common.thing[name]?[
                'is_non_enumerable',
                'is_not_user_generated',
            ]:[]
        ),
        // 'allow_multiple_authors', // TODO
    ], Thing.SchemaError);

    if( name.includes('.') ) {
        throw new Thing.SchemaError('Property name `'+name+'` contains `.` which is not allowed');
    }

    if( ! spec.validation ) {
        throw new Thing.SchemaError('validation is missing for '+name);
    }

    if( ! spec.validation.type ) {
        throw new Thing.SchemaError('validation.type is missing for '+name);
    }
    is_subset(Object.keys(spec.validation), ['type', 'test'], Thing.SchemaError);

    if( spec.value !== undefined && spec.value.constructor !== Function ) {
        throw new Thing.SchemaError('value is expected to be a Function');
    }

    if( ['add_to_view', 'value'].every(req => Object.keys(spec).includes(req)) ) {
        throw new Thing.SchemaError("Having a thing that is part of a view of referred thing in a computed property is not supported");
    }

    if( spec.cascade_save ) {
        const types = spec.validation.type.constructor === Array ? spec.validation.type : [spec.validation.type];
        if( types.some(t => !t || t.constructor!==String || !t.startsWith('Thing.')) ) {
            throw new Thing.SchemaError('`cascade_save` only make sense for referred things');
        }
        if( spec.cascade_save.constructor === Object ) {
            is_subset(Object.keys(spec.cascade_save), ['transitive_cascade'], Thing.SchemaError);
        }
    }
} 

function validate_schema_options({Thing, type, schema_, schema__options}) { 
    const keys = Object.keys(schema__options);

    is_subset(keys, [
        'additional_views',
        'is_unique',
        'side_effects',
        'is_private',
        'is_required',
        'graveyard',
    ], Thing.SchemaError);

    if( schema__options.is_required ) {
        if( ! ((schema__options.is_required||[]).length>0) ) {
            throw new Thing.SchemaError('`_options.is_required` should be a non-empty Array');
        }
        schema__options.is_required.forEach(prop => {
            if( ! schema_[prop] ) {
                throw new Thing.SchemaError('`_options.is_required` for `'+type+'` includes `'+prop+'` but it is not defined in the schema');
            }
        });
    }
} 

function validate_type_name({Thing, type}) { 
    if( type.startsWith('_') ) {
        throw new Thing.SchemaError('found type `'+type+"` but type isn't allowed to start with `_`");
    }
    if( ! /^[a-z][a-z_]*[a-z]$/.test(type) ) {
        throw new Thing.SchemaError('found type `'+type+'` but type name should be composed of lowercase letters and _');
    }
} 

function validate_schema_existence({Thing, schema_, type}) { 
    if( ! schema_ ) {
        throw new Thing.ValidationError('type `'+type+'` is missing a schema');
    }
    if( schema_.constructor!==Object ) {
        throw new Thing.SchemaError('schema of type `'+type+'` should be an object');
    }
    if( Object.keys(schema_).length === 0 ) {
        throw new Thing.SchemaError('schema of type `'+type+"` shouldn't be empty");
    }
} 

function is_subset(arr_subset, arr, _SchemaError) { 
    arr_subset.forEach(el => {
        if( ! arr.includes(el) ) {
            throw new _SchemaError('unknown option `'+el+'` found');
        }
    });
} 

