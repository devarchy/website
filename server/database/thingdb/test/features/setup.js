require('../../../../../.env');
require('mocha');
const assert = require('assert');
require('timerlog')({disable_all: true});

module.exports = setup;

function setup(Thing) {
    assert(Thing);

    return (
        function() {
            this.timeout(10*1000);
            return (
                Thing.database.management.purge_everything()
            );
        }
    );
}
