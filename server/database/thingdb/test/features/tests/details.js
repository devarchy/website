"use strict";
require('mocha');
const assert = require('better-assert');
const Thing = require('../thing').Thing;
const setup = require('../setup')(Thing);
const promise = require('../../test-promise')(Thing);
const population = require('../population');


describe("ThingDB details", () => {
    before(setup);

    before(population.create);

    /* TODO
    promise.it('properly handle properties set to undefined', () => { 
        Thing.database.load.view([{
            type: 'user',
            name: population.user.name,
            bio: undefined,
        }])
    }); 
    */

});
