"use strict";
require('mocha');
const assert = require('better-assert');
const Thing = require('../thing').Thing;
const setup = require('../setup')(Thing);
const promise = require('../../test-promise')(Thing);
const population = require('../population');

describe("ThingDB - misc", () => {
    before(setup);

    before(population.create_all);

    promise.it("can recompute things from events", () => {
        const value = new Date(new Date()-1);
        return (
            Thing.database.load.things({
                type: 'resource',
                computed_at: {
                    operator: '<=',
                    value,
                },
            })
            .then(things => {
                assert(things.length>0);
            })
        )
        .then(() =>
            Thing.recompute_all({
                type: 'resource',
                computed_at: {
                    operator: '<=',
                    value,
                },
            })
        )
        .then( () =>
            Thing.database.load.things({
                type: 'resource',
                computed_at: {
                    operator: '<=',
                    value,
                },
            })
            .then(things => {
                assert(things.length===0);
            })
        );
    });

    promise.it_validates_if("saving thing that is already existing after purging database (unique constraints are not lost after deleting database)",
        () => ( 
            (
                Thing.database.management.purge_everything()
            )
            .then(() =>
                population.create_all()
            )
            .then(() =>
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


});
