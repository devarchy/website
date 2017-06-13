const assert_soft = require('assert');
const Promise = require('bluebird'); Promise.longStackTraces();


module.exports = apply_defaults;


function apply_defaults(thing, {schema__props__ordered}) {
    schema__props__ordered
    .forEach(({property, default_value}) => {
        assert_soft( property );
        assert_soft( default_value===undefined || default_value!==null && [Boolean, Number, String].includes(default_value.constructor) );

        if( default_value === undefined ) {
            return;
        }

        assert_soft( thing[property]!==null );
        if( thing[property] !== undefined ) {
            return;
        }

        thing[property] = default_value;
    });
}
