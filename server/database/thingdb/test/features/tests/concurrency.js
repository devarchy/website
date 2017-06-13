"use strict";
require('mocha');
const assert = require('better-assert');
const assert_node = require('assert');
const assert_chai = require('chai').assert;
const Thing = require('../thing').Thing;
const setup = require('../setup')(Thing);
const Promise_serial = require('promise-serial');
const Promise = require('bluebird'); Promise.longStackTraces();
const promise = require('../../test-promise')(Thing);


describe("ThingDB and concurrency", () => {
    before(setup);

    let tag;
    let user_id;
    before(() =>
        (
            new Thing({
                type: 'user',
                name: 'fake-user-'+Math.random(),
                draft: {},
            })
            .draft.save()
            .then(([user]) => user_id = user.id)
        )
        .then(() =>
            new Thing({
                type: 'tag',
                draft: {
                    name: 'concurrency-test-tag',
                    author: user_id,
                },
            })
            .draft.save()
            .then(([tag_]) => tag = tag_)
        )
    )

    let resource;
    promise.it("can concurrently upsert a new thing",
        () => {
            const name = 'fake-resource-'+Math.random();
            return (
                Promise.all(
                    Array.apply(null, {length: 10})
                    .map(() => upsert_resource())
                )
                .then(results => {
                    results.forEach(things => {
                        assert(things);
                        assert(things.length === 1);
                        assert(things[0].id);
                        assert(things[0].name === name);
                        assert(things[0].history.length === 1);
                    });
                    resource = results[0][0];
                })
            );
            function upsert_resource() {
                return (
                    new Thing({
                        type: 'resource',
                        name,
                        author: user_id,
                        draft: {},
                    }).draft.save()
                    .then(things => {
                        assert(things.length>=1);
                        assert(things.length===1);
                        assert(things[0].id);
                        assert(things[0].type==='resource');
                        assert(things[0].name===name);
                        return things;
                    })
                );
            }
        },
        { timeout: 120*1000 }
    );

    promise.it("can aggressively and repeatedly hit validation", () =>
        // tests proper rollback-ing of transactions
        Promise_serial(
            Array.apply(null, {length: 150})
            .map(() => {
                const url = Math.random() < 0.5 ? 'fakedomain' : 'ftp://fakedomain';
                return (
                    () => (
                        new Thing({
                            type: 'resource',
                            draft: {
                                url,
                                author: user_id,
                            },
                        }).draft.save()
                        .then(() => {
                            assert(false);
                        })
                        .catch(err => {
                            if( url==='fakedomain' ) {
                                if( (err.message||'').includes('missing `://`') ) {
                                    return;
                                }
                            }
                            if( url==='ftp://fakedomain' ) {
                                if( (err.message||'').includes('property `url` with value `ftp://fakedomain` failed validation test provided by schema') ) {
                                    return;
                                }
                            }
                            throw err;
                        })
                    )
                );
            })
        )
    )

    promise.it("can concurrently upsert different drafts of same thing",
        () => {
            assert(resource.id);
            assert(tag.id);
            assert(user_id);
            return (
                Promise.all(
                    Array.apply(null, {length: 19})
                    .map(() =>
                        new Thing({
                            type: 'tagged',
                            referred_resource: resource.id,
                            referred_tag: tag.id,
                            draft: {
                                is_removed: Math.random()<0.5,
                                author: user_id,
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
                            assert( [false, true].includes(e.json_data.is_removed) );
                            if( i !== 0 ) {
                                assert( Object.keys(e.json_data).length === 1 );
                            }
                            else {
                                assert( Object.keys(e.json_data).length === 3 );
                                assert( e.json_data.referred_tag === tag.id );
                                assert( e.json_data.referred_resource === resource.id );
                            }
                        });
                    });
                })
            );
        },
        { timeout: 40*1000 }
    );

    promise.it(
        "can several times tag several resources, concurrently",
        () => (
            Promise.all(
                Array.apply(null, {length: 10})
                .map(() =>
                    new Thing({
                        type: 'resource',
                        name: 'a resource '+Math.random(),
                        author: user_id,
                    })
                    .draft.save()
                    .then(things => {
                        assert(things.length>=1);
                        assert(things.length===1);
                        assert(things[0].type==='resource');
                        assert(things[0].id);
                        return things[0];
                    })
                )
            )
            .then(resources =>
                Promise.all(
                    resources
                    .map(r => [
                        new Thing({
                            type: 'tagged',
                            referred_resource: r.id,
                            referred_tag: tag.id,
                            draft: {
                                is_removed: Math.random()<0.5,
                                author: user_id,
                            },
                        }).draft.save()
                        .then(things => {
                            // make sure that concurrency failure recovering doesn't break output
                            assert_node(things.length===2, JSON.stringify(things, null, 2))
                        }),
                        new Thing({
                            type: 'tagged',
                            referred_resource: r.id,
                            referred_tag: tag.id,
                            draft: {
                                is_removed: Math.random()<0.5,
                                author: user_id,
                            },
                        }).draft.save()
                        .then(things => {
                            // make sure that concurrency failure recovering doesn't break output
                            assert_node(things.length===2, JSON.stringify(things, null, 2))
                        }),
                    ])
                    .reduce((prev, curr) => prev.concat(curr), [])
                )
            )
        ),
        { timeout: 20*1000 }
    );

});
