const deasync = require('deasync');

module.exports = function(Thing){
    return deasync(function(cb){
        Thing.database.load.things({})
        .then(things => {
            cb(null, things);
        });
    })();
};
