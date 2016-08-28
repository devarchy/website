const deasync = require('deasync');

module.exports = function(){
    const Thing = require('../index.js');

    return deasync(function(cb){
        Thing.database.load.things({})
        .then(things => {
            cb(null, things);
        });
    })();
};
