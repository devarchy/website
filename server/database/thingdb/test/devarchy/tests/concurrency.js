"use strict";
require('mocha');
const assert = require('better-assert');
const assert_node = require('assert');
const assert_chai = require('chai').assert;
const Thing = require('../thing');
const promise = require('../../test-promise')(Thing);
require('../../setup')(Thing);
const population = require('../population');


describe('ThingDB Concurrent Safety', () => {

    before(population.create);

    let tag;
    before(done => {
        tag = new Thing({
            type: 'tag',
            draft: {
                name: 'concurrency-test-tag',
                definition: 'tag to test concurrency',
                author: population.user.id,
            },
        });
        tag.draft.save()
        .then(() => { done() });
    })

    promise.it(
        "can concurrently upsert several draft of same thing",
        () => Promise.all(
            Array.apply(null, {length: 19})
            .map(() =>
                new Thing({
                    type: 'tagged',
                    referred_resource: population.resource.id,
                    referred_tag: tag.id,
                    draft: {
                        removed: Math.random()<0.5,
                        author: population.user.id,
                    },
                }).draft.save()
                .then(things => {
                    // make sure that retries return correctly
                    assert_node(things.length===2, JSON.stringify(things, null, 2))
                })
            )
        )
        .then(() => {
            return (
                Thing.db_handle('thing_event')
                .where({"type": 'tagged'})
                .orderBy('created_at')
            )
            .then(events => {
                assert_chai.isAtLeast(events.length, 19);
                const thing_id = events[events.length-1].id_thing;
                const thing_events = events.filter(e => e.id_thing === thing_id);
                assert_chai.equal(thing_events.length, 19);
                thing_events.forEach((e, i) => {
                    assert( [false, true].includes(e.json_data.removed) );
                    if( i !== 0 ) {
                        assert( Object.keys(e.json_data).length === 1 );
                    }
                    else {
                        assert( Object.keys(e.json_data).length === 3 );
                        assert( e.json_data.referred_tag === tag.id );
                        assert( e.json_data.referred_resource === population.resource.id );
                    }
                });
            });
        }),
        { timeout: 40*1000 }
    );

    promise.it(
        "can several times tag several resources, concurrently",
        () => Promise.all(
            population.resources
            .map(p => [
                new Thing({
                    type: 'tagged',
                    referred_resource: p.id,
                    referred_tag: tag.id,
                    draft: {
                        removed: Math.random()<0.5,
                        author: population.user.id,
                    },
                }).draft.save()
                .then(things => {
                    // make sure that retries return correctly
                    assert_node(things.length===2, JSON.stringify(things, null, 2))
                }),
                new Thing({
                    type: 'tagged',
                    referred_resource: p.id,
                    referred_tag: tag.id,
                    draft: {
                        removed: Math.random()<0.5,
                        author: population.user.id,
                    },
                }).draft.save()
                .then(things => {
                    // make sure that retries return correctly
                    assert_node(things.length===2, JSON.stringify(things, null, 2))
                }),
            ])
            .reduce((prev, curr) => prev.concat(curr), [])
        ),
        { timeout: 20*1000 }
    );

});
