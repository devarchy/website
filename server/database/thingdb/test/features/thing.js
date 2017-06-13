const assert = require('assert');
module.exports = {
    Thing: init_Thing(require('./schema.js'), null),
    custom_schema: init_Thing,
};

function init_Thing(schema, name) {
    let database_name = 'devarchy__tests__features';
    assert(schema.constructor===Object);
    assert(name===null || (name||{}).constructor === String);
    if( name ) {
        database_name += '__'+name;
    }
    return (
        require('../thing')({
            database_name,
            schema,
        })
    );
}
