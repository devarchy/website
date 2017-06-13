"use strict";
require('mocha');
const assert = require('better-assert');
const Promise_serial = require('promise-serial');
const Thing = require('../thing').Thing;
const setup = require('../setup')(Thing);
const promise = require('../../test-promise')(Thing);
const population = require('../population');


describe("ThingDB - migration", () => {
    before(setup);

    before(population.create);

    promise.it("can recompute things", () => ( 
        Thing.database.load.all_things()
        .then(things =>
            Promise_serial(
                things.map(t => () => t.recompute())
            )
        )
    )); 

});
