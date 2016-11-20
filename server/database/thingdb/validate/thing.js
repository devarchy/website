"use strict";
const assert = require('better-assert');
const validator = require('validator');
const validate_schema = require('./schema.js');
const schema_common = require('../schema_common.js');
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


function correctness(thing, {Thing}) {
    validate(thing, false, false, {Thing});
}

function correctness_and_completness_without_draft(thing, {Thing}) {
    validate(thing, true, false, {Thing});
}

function correctness_and_completness_with_draft(thing, {Thing}) {
    validate(thing, true, true, {Thing});
}


function validate(thing, validate_completness, validate_completness_with_draft, {Thing}) { 
    assert(Thing);
    assert(Thing.database);

    validate_schema({Thing});

    const schema_missing_error = validate_if_schema_exists_for_type(thing, {Thing});
    if( schema_missing_error )
        throw_errors(thing, [schema_missing_error], {Thing});

    let errors = [];

    errors = errors.concat(
        validate_props({
            object: thing.draft,
            schema: thing.schema,
            validate_completness: false,
            schema_addendum: schema_common.draft,
            Thing,
        })
    );

    errors = errors.concat(
        validate_props({
            object: thing,
            schema: thing.schema,
            validate_completness: false,
            schema_addendum: schema_common.thing,
            Thing,
        })
    );

    if( validate_completness ) {
        if( ! validate_completness_with_draft ) {
            assert(Object.keys(thing.draft).length === 0);
        }
        if( validate_completness_with_draft ) {
            if( ! thing.draft.author ) {
                errors.push('author is always required on draft');
            }
        }
        errors = errors.concat(
            validate_props({
                object: validate_completness_with_draft ? Object.assign({}, thing, thing.draft) : thing,
                schema: thing.schema,
                validate_completness: true,
                schema_addendum: schema_common.thing,
                Thing,
            })
        );
    }

    errors = errors.concat(
        validate_immuatibilty(thing, thing.draft, thing.schema)
    );

    throw_errors(thing, errors, {Thing});

}; 

function validate_props(arg) { 
    assert(arg.Thing);
    assert(arg.Thing.ValidationError);
    assert(arg.object);
    assert(arg.schema);
    assert(arg.schema_addendum);
    assert(arg.validate_completness.constructor === Boolean);

    const validate_correctness = true;

    const errors = [];

    const schema = Object.assign({}, arg.schema_addendum, arg.schema);


    for(let prop in arg.object) {
        let prop_spec = schema[prop];

        let value = arg.object[prop];

        if( validate_correctness ) {
            prop_is_correct(prop, value, prop_spec);
        }

        if( arg.validate_completness ) {
            prop_is_complete(prop, value, prop_spec);

        }
    }

    for(let prop in schema) {
        let prop_spec = schema[prop];

        if( ! arg.validate_completness ) {
            continue;
        }
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

    if( arg.validate_completness ) {
        const required_props = (arg.schema._options||{}).is_required;
        if( required_props && required_props.every(prop => is_missing(arg.object[prop])) ) {
            errors.push('all of `['+required_props.join(',')+"]` are missing but one of them shouldn't be");
        }
    }

    for(let prop in arg.required_props) {
        let prop_spec = schema[prop];

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

        assert(prop_spec.validation);

        // TODO - implement validation for type 'Thing.resource', ...
        assert(prop_spec.validation.type);
        if( [String, Array].includes( prop_spec.validation.type.constructor ) ) {
            if( ! value || ! validator.isUUID(value) ) {
                errors.push('property `'+prop+'` has value `'+value+'` but value is expected to be a UUID');
            }
        }
        else {
            if( [null, undefined].includes(value) || value.constructor !== prop_spec.validation.type ) {
                if( ! [null, undefined].includes(value) ) {
                    errors.push('property `'+prop+'` has value `'+value+'` but value is expected to be a '+prop_spec.validation.type);
                }
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

function validate_immuatibilty(thing, draft, schema) { 
    const errors = [];
    for(var prop in draft) {
        if( ((schema||{})[prop]||{}).immutable ) {
            if( thing[prop] !== undefined ) {
                errors.push('trying to alter immutable property `'+prop+'` from `'+thing[prop]+'` to `'+draft[prop]+'`');
            }
        }
    }
    return errors;
} 

function throw_errors(thing, errors, {Thing}) { 
    assert(Thing);
    assert(Thing.database);
    assert(errors.constructor === Array);

    if( errors.length > 0 ) {
        throw new Thing.ValidationError(
            [
                '',
                'Thing',
                thing,
                'with schema',
                JSON.stringify(thing.schema, null, 2),
                'is invalid for the following reason(s)',
            ].concat(errors)
            .join('\n')
        );
    }
} 

function validate_if_schema_exists_for_type(thing, {Thing}) { 
    assert(Thing);
    assert(Thing.database);

    if( ! Thing.schema[thing.type] ) {
        return 'a thing has type `'+thing.type+'` but no schema for `'+thing.type+'` has been provided, i.e. `Thing.schema['+thing.type+']==undefined`';
    }
    assert( thing.schema === (Thing.schema||{})[thing.type] );
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
    return (thing, {Thing}) => {
        const ValidationError = Thing.ValidationError;
        assert(ValidationError);
        try {
            fct(thing, {Thing});
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
