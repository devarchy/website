"use strict";
require('mocha');
const assert = require('better-assert');
const chai_assert = require('chai').assert;
const Thing = require('../thing').Thing;
const setup = require('../setup')(Thing);
const promise = require('../../test-promise')(Thing);
const population = require('../population');


describe("ThingDB - views", () => {
    before(setup);

    before(population.create);

    promise.it('returns no things when retrieving a view for a non existing tag', () => ( 
        // this test's purpose is to catch bug when whole database is being targeted because of `select ARRAY[11] @> ARRAY[]::integer[]`
        Thing.database.load.view([{
            type: 'tag',
            name: 'tag-that-dont-exist-'+Math.random(),
        }])
        .then(view_things => {
            assert(view_things.length === 0);
        })
    )); 

    promise.it("can view resources that are tagged with several given tags", () => { 
        const tag1 =
            new Thing({
                type: 'tag',
                draft: {
                    name: 'fake-tag1-'+Math.random(),
                    author: population.user.id,
                },
            });

        const tag2 =
            new Thing({
                type: 'tag',
                draft: {
                    name: 'fake-tag2-'+Math.random(),
                    author: population.user.id,
                },
            });

        const resource1 =
            new Thing({
                type: 'resource',
                draft: {
                    name: 'fake resource 1 - '+Math.random(),
                    author: population.user.id,
                },
            });
        const resource2 =
            new Thing({
                type: 'resource',
                draft: {
                    name: 'fake resource 2 - '+Math.random(),
                    author: population.user.id,
                },
            });
        const resource3 =
            new Thing({
                type: 'resource',
                draft: {
                    name: 'fake resource 3 - '+Math.random(),
                    author: population.user.id,
                },
            });


        return (
            (
                Promise.all([
                    tag1.draft.save(),
                    tag2.draft.save(),
                    resource1.draft.save(),
                    resource2.draft.save(),
                    resource3.draft.save(),
                ])
            )
            .then(() =>
                Promise.all(
                    [
                        ...[resource1, resource2].map(r => ({
                            referred_tag: tag1.id,
                            referred_resource: r.id,
                            is_removed: false,
                        })),
                        ...[resource2, resource3].map(r => ({
                            referred_tag: tag2.id,
                            referred_resource: r.id,
                            is_removed: false,
                        })),
                        {
                            referred_tag: tag1.id,
                            referred_resource: resource3.id,
                            is_removed: true,
                        },
                        {
                            referred_tag: tag2.id,
                            referred_resource: resource1.id,
                            is_removed: true,
                        },
                    ]
                    .map(({referred_resource, referred_tag, is_removed}) =>
                        new Thing({
                            type: 'tagged',
                            referred_resource,
                            referred_tag,
                            draft: {
                                is_removed,
                                author: population.user.id,
                            },
                        }).draft.save()
                    )
                )
            )
            .then(() =>
                Thing.database.load.view([
                    {
                        type: 'tag',
                        name: tag1.name,
                    },
                ])
            )
            .then(things => {
                chai_assert.equal(things.length, 7);
                const resources = things.filter(t => t.type==='resource');
                assert( resources.length > 0 );
                assert( resources.length === 2 );
                assert( resources.find(({id}) => id===resource1.id) );
                assert( resources.find(({id}) => id===resource2.id) );
            })
            .then(() =>
                Thing.database.load.view([
                    {
                        type: 'tag',
                        name: tag2.name,
                    },
                ])
            )
            .then(things => {
                chai_assert.equal(things.length, 7);
                const resources = things.filter(t => t.type==='resource');
                assert( resources.length > 0 );
                assert( resources.length === 2 );
                assert( resources.find(({id}) => id===resource2.id) );
                assert( resources.find(({id}) => id===resource3.id) );
            })
            .then(() =>
                Thing.database.load.view([
                    {
                        type: 'tag',
                        name: tag1.name,
                    },
                    {
                        type: 'tag',
                        name: tag2.name,
                    },
                ])
            )
            .then(things => {
                chai_assert.equal(things.length, 4);
                const resources = things.filter(t => t.type==='resource');
                assert( resources.length > 0 );
                assert( resources.length === 1 );
                assert( resources[0].id === resource2.id );
            })
        );
    }); 

    promise.it("returns no unrelated things when retrieving a view", () => { 
        const tag_names = ['tag-test-1', 'tag-test-2', 'tag-test-3', ];
        return (
            Promise.all(
                tag_names
                .map(name =>
                    new Thing({
                        type: 'tag',
                        draft: {
                            name,
                            author: population.user.id,
                        },
                    }).draft.save()
                )
            )
            .then( () =>
                Thing.database.load.view([{
                    id: population.resource.id,
                }])
            )
            .then(things => {
                assert(tag_names.every(tag_name => things.find(({type, name}) => type==='tag' && name===tag_name)===undefined));
            })
        );
    }); 

});
