require('../../../../.env');
require('mocha');
const assert = require('assert');
require('timerlog')({disable_all: true});

module.exports = setup;

const already_run = new WeakMap();

function setup(Thing, n) {
    assert(Thing);

    if( already_run.has(Thing) ) {
        return;
    }
    already_run.set(Thing);

    const promise = require('./test-promise')(Thing);

    describe('ThingDB management', () => {

        promise.it('can delete and re-create database schema', () =>
            (
                Thing.database.management.delete_all()
            )
            .then(() =>
                Thing.database.management.create_schema()
            )
        )
    });
}
