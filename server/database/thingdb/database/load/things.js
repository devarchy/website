const assert = require('assert');
const util = require('./util');


module.exports = function(props){
    assert( props && Object.keys(props).length>=0 && props.length===undefined );
    return util.retrieve_by_filter.apply(null, ['thing_aggregate'].concat([].slice.call(arguments)));
};
