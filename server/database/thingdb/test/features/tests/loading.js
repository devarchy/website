"use strict";
require('mocha');
const assert = require('better-assert');
const Thing = require('../thing').Thing;
const setup = require('../setup')(Thing);
const promise = require('../../test-promise')(Thing);
const population = require('../population');


describe("ThingDB - things loading", () => {
    before(setup);

    before(population.create);

    promise.it('filter support arbitrary knex operators', () => {
        const resource = population.resources[0];
        const resource2 = population.resources[1];
        assert(resource.created_at && resource2.created_at && resource.created_at !== resource2.created_at);
        const resource_latest = resource2.created_at > resource.created_at ? resource2 : resource;
        const resource_first = resource_latest === resource2 ? resource : resource2;
        return (
            Thing.database.load.things({
                type: 'resource',
                created_at: {
                    operator: '<',
                    value: resource_latest.created_at,
                },
            })
        )
        .then(things => {
            assert( things.every(t => t.id !== resource_latest.id) );
            assert( things.some(t => t.id === resource_first.id) );
        })
    });

});


