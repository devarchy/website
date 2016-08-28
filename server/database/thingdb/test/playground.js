"use strict";
require('./setup');
require('mocha');
const assert = require('better-assert');
const Promise = require('bluebird'); Promise.longStackTraces();
const promise = require('./test-promise')();
const population = require('./population');
const Thing = require('../index.js')


describe('ThingDB', () => {

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

