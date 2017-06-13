"use strict";
const assert = require('better-assert');
const validator = require('validator');
const validate_schema = require('./schema.js');
const AssertionError = require('assert').AssertionError;


module.exports = {
    correctness,
    correctness_and_completness_without_draft,
    correctness_and_completness_with_draft,
    assert: {
        correctness: assertize(correctness),
        correctness_and_completness_without_draft: assertize(correctness_and_completness_without_draft),
        correctness_and_completness_with_draft: assertize(correctness_and_completness_with_draft),
    },
};


function correctness(thing, args) {
    validate(thing, false, false, args);
}

function correctness_and_completness_without_draft(thing, args) {
    validate(thing, true, false, args);
}

function correctness_and_completness_with_draft(thing, args) {
    validate(thing, true, true, args);
}


function validate(thing, validate_completness, validate_completness_with_draft, {Thing, schema__props_spec, schema__draft_props_spec, schema__options}) { 
    assert(Thing);
    assert(Thing.database);

    validate_schema({Thing, type: thing.type, schema__options, schema_: schema__props_spec});
    validate_schema({Thing, type: thing.type, schema__options, schema_: schema__draft_props_spec});

    assert(schema__props_spec);
    assert(schema__draft_props_spec);
    assert(schema__options);

    let errors = [];

    errors = errors.concat(
        validate_props({
            object: thing.draft,
            schema_: schema__draft_props_spec,
            validate_completness: false,
            Thing,
            schema__options,
        })
    );

    errors = errors.concat(
        validate_props({
            object: thing,
            schema_: schema__props_spec,
            validate_completness: false,
            Thing,
            schema__options,
        })
    );

    if( validate_completness ) {
        if( ! validate_completness_with_draft ) {
            const draft_size = Object.keys(thing.draft).length;
            assert(draft_size === 0 || draft_size === 1 && thing.draft.author);
        }
        if( validate_completness_with_draft ) {
            if( ! thing.draft.author ) {
                errors.push('author is always required on draft');
            }
        }
        errors = errors.concat(
            validate_props({
                object: validate_completness_with_draft ? Object.assign({}, thing, thing.draft) : thing,
                schema_: schema__props_spec,
                validate_completness: true,
                Thing,
                schema__options,
            })
        );
    }

    errors = errors.concat(
        validate_immuatibilty(thing, schema__props_spec)
    );

    throw_errors(thing, errors, {Thing, schema__props_spec});

}; 

function validate_props(arg) { 
    assert(arg.Thing);
    assert(arg.Thing.ValidationError);
    assert(arg.object);
    assert(arg.schema_);
    assert(arg.schema__options);
    assert(arg.validate_completness.constructor === Boolean);

    const schema_ = arg.schema_;

    const validate_correctness = true;

    const errors = [];


    for(let prop in arg.object) {
        let prop_spec = schema_[prop];

        let value = arg.object[prop];

        if( validate_correctness ) {
            prop_is_correct(prop, value, prop_spec);
        }

        if( arg.validate_completness ) {
            prop_is_complete(prop, value, prop_spec);
        }
    }

    if( arg.validate_completness ) {
        for(let prop in schema_) {
            let prop_spec = schema_[prop];

            if( ! prop_spec.is_required ) {
                continue;
            }

            // TODO be smarter
            if( prop_spec.value ) {
                continue;
            }

            let value = arg.object[prop];
            if( is_missing(value) ) {
                errors.push('property `'+prop+'` is missing but according to schema it is required');
            }
        }

        const required_props = arg.schema__options.is_required;
        if( required_props && required_props.every(prop => is_missing(arg.object[prop])) ) {
            errors.push('all of `['+required_props.join(',')+"]` are missing but one of them shouldn't be");
        }
    }

    for(let prop in arg.required_props) {
        let prop_spec = schema_[prop];

        if( ! arg.validate_completness ) {
            continue;
        }

        let value = arg.object[prop];
        if( is_missing(value) ) {
            errors.push('property `'+prop+'` is missing but according to schema it is a required property');
        }
    }

    return errors;

    function prop_is_correct(prop, value, prop_spec) {
        if( ! prop_spec ) {
            errors.push('property `'+prop+'` found but it is not defined in the schema');
            return;
        }

        if( value === undefined ) {
            errors.push('property `'+prop+'` is equal to `undefined` which is forbidden');
            return;
        }

        assert(prop_spec.validation);

        // TODO - implement validation for type 'Thing.resource', ...
        assert(prop_spec.validation.type);
     // const eraser_value = [null, undefined];
        const eraser_value = [null];
        if( [String, Array].includes( prop_spec.validation.type.constructor ) ) {
            if( !eraser_value.includes(value) && (!value || value.constructor!==String || !validator.isUUID(value)) ) {
                errors.push('property `'+prop+'` has value `'+value+'` but value is expected to be a UUID');
            }
        }
        else {
            // TODO properly handle unserialze Date from DB (problem: JSON saves Date as String -> same for json_data)
            const types = prop_spec.validation.type === Date ? [Date, String] : [prop_spec.validation.type];
            if( !eraser_value.includes(value) && !types.includes(value.constructor) ) {
                errors.push('property `'+prop+'` has value `'+value+'` but value is expected to be a '+prop_spec.validation.type);
            }
        }

        let test = prop_spec.validation.test;
        if( test ) {
            if( ! test(value, {Thing: arg.Thing}) ) {
                errors.push('property `'+prop+'` with value `'+value+'` failed validation test provided by schema');
            }
        }
    }

    function prop_is_complete(prop, value, prop_spec ) {
        const required_props = (prop_spec||{}).required_props;
        if( required_props ) {
            required_props.forEach(p => {
                if( is_missing(value[p]) ) {
                    errors.push('proprety `'+p+'` of `'+prop+'` is missing but it is required');
                }
            });
        }
    }
} 

function validate_immuatibilty(thing, schema__props_spec) { 
    const errors = [];
    for(var prop in thing.draft) {
        if( (schema__props_spec[prop]||{}).immutable ) {
            if( thing[prop]!==undefined && thing[prop] !== thing.draft[prop] ) {
                errors.push('trying to alter immutable property `'+prop+'` from `'+thing[prop]+'` to `'+thing.draft[prop]+'`');
            }
        }
    }
    return errors;
} 

function throw_errors(thing, errors, {Thing, schema__props_spec}) { 
    assert(Thing);
    assert(Thing.database);
    assert(errors.constructor === Array);

    const err_msg =
        []
        .concat([
            '',
            'Thing',
            thing,
        ])
        .concat([
            'with schema props',
            JSON.stringify(schema__props_spec, null, 2),
        ])
        .concat([
            'is invalid for the following reason(s)',
            ...errors,
        ]);

    if( errors.length > 0 ) {
        throw new Thing.ValidationError(
            err_msg.join('\n')
        );
    }
} 

function is_missing(value) { 
    assert(!NaN === true);
    assert(!null === true);
    assert(!undefined === true);
    // Note that;
    assert((NaN===NaN) === false);
    return ! value && value !== 0 && value !== false;
} 

function assertize(fct) { 
    return (thing, args) => {
        const ValidationError = args.Thing.ValidationError;
        assert(ValidationError);
        try {
            fct(thing, args);
        }
        catch(err) {
            assert(new ValidationError('foo').constructor === ValidationError);
            if( err.constructor === ValidationError ) {
                throw new AssertionError({message: err.message});
            }
            throw err;
        }
    }
} 
