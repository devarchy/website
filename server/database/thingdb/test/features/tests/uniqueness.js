"use strict";
require('mocha');
const assert = require('better-assert');
const Thing = require('../thing')
require('../../setup')(Thing);
const promise = require('../../test-promise')(Thing);
const population = require('../population');


describe("ThingDB's upsert support", () => {

    before(population.create);

    before(done =>
        new Thing({
            type: 'resource',
            draft: {
                author: population.user.id,
                name: 'Romuald',
            },
        })
        .draft.save()
        .then(() => done())
    );

    promise.it_validates_if("saving entry with already existing computed value with `is_unique===true`", () =>
        new Thing({
            type: 'resource',
            draft: {
                author: population.user.id,
                name: '@romuald',
            },
        }).draft.save(),
        { reason: "Thing with type `resource` and name_normalized `romuald` already exists in database"}
    );
});

