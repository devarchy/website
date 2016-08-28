const util = require('./util');


module.exports = function(){
    return util.retrieve_by_filter.apply(null, ['thing_event'].concat([].slice.call(arguments)));
};
