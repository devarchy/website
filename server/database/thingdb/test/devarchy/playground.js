"use strict";
require('mocha');
const assert = require('better-assert');
const Promise = require('bluebird'); Promise.longStackTraces();
const Thing = require('./thing')
const promise = require('../test-promise')(Thing);
const setup = require('./setup')(Thing);
const population = require('./population');


describe('ThingDB', () => {

    before(setup);

    before(population.create);

    promise.it("can remove not required properties", () =>
        /*
        new Thing({
            draft: {
                author: population.user.id,
            }
        }).draft.save()
        */
    );

});

