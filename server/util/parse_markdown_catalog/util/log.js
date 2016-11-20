const options = require('./options');

module.exports = function log() { 
    if( ! options.debug ) {
        return
    }
    console.log.apply(console, arguments);
}; 
