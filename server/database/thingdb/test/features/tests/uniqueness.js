"use strict";
require('mocha');
const assert = require('better-assert');
const Thing = require('../thing').Thing;
const setup = require('../setup')(Thing);
const promise = require('../../test-promise')(Thing);
const population = require('../population');


describe("ThingDB's uniqueness handling", () => {
    before(setup);

    before(population.create_all);

    before(done => {
        new Thing({
            type: 'resource',
            draft: {
                author: population.user.id,
                name: 'Romuald',
            },
        })
        .draft.save()
        .then(() => done())
    });

    promise.it_validates_if("saving thing that is already existing",
        () => ( 
            (
                new Thing({
                    type: 'tag',
                    draft: {
                        name: population.tags[0].name,
                        author: population.user.id,
                    },
                })
                .draft.save()
            )
            .then(() => {
                return (
                    Thing.database.load.things({
                        type: 'tag',
                        name: population.tags[0].name,
                    })
                );
            })
            .then(things => {
                assert(things.length < 2);
                assert(things.length === 1);
            })
        ), 
        { reason: /Thing with type `tag` and name `.*` already exists in database/}
    );

    promise.it_validates_if("saving thing with already existing computed value with `is_unique===true`",
        () => {
            return (
                (
                    Thing.database.load.things({
                        type: 'resource',
                        name_normalized: 'romuald',
                    })
                )
                .then(things => {
                    assert(things.length===1);
                    assert(things[0].name_normalized==='romuald');
                    assert(things[0].name==='Romuald');
                })
                .then(() =>
                    new Thing({
                        type: 'resource',
                        draft: {
                            author: population.user.id,
                            name: '@romuald',
                        },
                    }).draft.save()
                )
                .then(() => {
                    return (
                        Thing.database.load.things({
                            type: 'resource',
                            name_normalized: 'romuald',
                        })
                    );
                })
                .then(things => {
                    assert(things.length < 2);
                    assert(things.length === 1);
                })
            );
        },
        { reason: "Thing with type `resource` and name_normalized `romuald` already exists in database"}
    );
});

