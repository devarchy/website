"use strict";
require('mocha');
const assert = require('better-assert');
const Thing = require('../thing').Thing;
const setup = require('../setup')(Thing);
const promise = require('../../test-promise')(Thing);
const population = require('../population');


describe("ThingDB - core", () => {
    before(setup);

    before(population.create);

    let tag;
    promise.it("can save a thing", () => ( 
        new Thing({
            type: 'tag',
            draft: {
                author: population.user.id,
                name: 'A Tag '+Math.random(),
                description: 'remove me',
                title: 'remove me too',
            },
        }).draft.save_draft()
        .then(({things_matched: [tag_]}) => {
            assert(tag_.description==='remove me');
            assert(tag_.title==='remove me too');
            tag = tag_;
        })
    )); 

    promise.it("can remove not required properties", () => ( 
        (
            new Thing({
                type: 'tag',
                name: tag.name,
                draft: {
                    author: population.user.id,
                    description: null,
                },
            }).draft.save()
        )
        .then(([tag]) => {
            assert([null, undefined].includes(tag.description));
            assert(tag.title==='remove me too');
            return tag;
        })
        .then(tag =>
            new Thing({
                type: 'tag',
                name: tag.name,
                title: null,
                author: population.user.id,
                draft: {},
            }).draft.save()
        )
        .then(([tag]) => {
            assert([null, undefined].includes(tag.description));
            assert([null, undefined].includes(tag.title));
        })
    )); 

    promise.it("can save changes with only the thing ID and the changes", () => { 
        const description_new = 'new description '+Math.random();
        const tag_original = Object.assign({}, population.tags[0]);
        assert(tag_original.id);
        return (
            (
                Thing.database.load.things({
                    id: tag_original.id,
                })
            )
            .then(things => {
                assert(things.length === 1);
                const tag = things[0];
                assert(tag.id === tag_original.id);
                assert(tag.name === tag_original.name);
                assert(tag.description === tag_original.description);
                assert(tag_original.description !== description_new);

                return (
                    new Thing({
                        id: tag_original.id,
                        draft: {
                            description: description_new,
                            author: population.user.id,
                        },
                    }).draft.save()
                );
            })
            .then(things => {
                assert(things.length === 1);
                const tag = things[0];
                assert( tag.id === tag_original.id );
                assert( tag.description === description_new);
                assert( tag.name === tag_original.name );
                assert( tag.author === population.user.id );
            })
        );
    }); 

    promise.it("can generate an id", () => { 
        const name = 'A Tag '+Math.random();

        const thing = new Thing({
            type: 'tag',
            draft: {
                author: population.user.id,
                name,
            },
        });

        assert(thing.id===undefined);
        thing.generate_id();
        assert(thing.id);
        const id = thing.id;

        return (
            thing.draft.save()
            .then(things => {
                assert(things.length === 1);
                assert(things[0].name===name);
                assert(things[0].id===id);
            })
        );
    }); 
    promise.it_validates_if("but validate using an generated id while upserting", () =>
        { 
            const name = 'A Tag '+Math.random();

            const thing = new Thing({
                type: 'tag',
                author: population.user.id,
                name,
            });

            assert(thing.id===undefined);
            thing.generate_id();
            assert(thing.id);
            const id = thing.id;

            return (
                thing.draft.save()
                .then(things => {
                    assert(things.length === 1);
                    assert(things[0].name===name);
                    assert(things[0].id===id);
                })
            );
        }, 
        { reason: "Using a generated ID of a thing to then upsert this thing doesn't make sense" }
    );
});
