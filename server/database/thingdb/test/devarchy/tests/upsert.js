"use strict";
require('mocha');
const assert = require('better-assert');
const assert_chai = require('chai').assert;
const Thing = require('../thing')
require('../../setup')(Thing);
const promise = require('../../test-promise')(Thing);
const population = require('../population');


describe("ThingDB supports upserts", () => {

    before(population.create);

    let event_count;
    before(done => {
        Thing.db_handle('thing_event')
        .then(events => {
            event_count = events.length;
            done();
        });
    });

    promise.it("when upserting and stumbling upon already existing thing: updates new properties", () => {
        const definition = 'new definition for tag of population';
        assert( definition !== population.tag.definition );
        return new Thing({
            type: 'tag',
            name: population.tag.name,
            definition,
            draft: {
                author: population.user.id,
            },
        }).draft.save()
        .then(([tag]) => {
            assert(tag.id === population.tag.id);
            assert(tag.name === population.tag.name);
            assert(tag.definition === definition);
            return (
                Thing.db_handle('thing_event').orderBy('created_at')
            )
            .then(events => {
                assert_chai.equal(events.length, ++event_count);
            })
        })
    });


    promise.it("when upserting and stumbling upon already existing thing: does not create a new `thing_event` when draft is empty", () =>
        new Thing({
            type: 'resource',
            github_full_name: 'brillout/gulp-jspm',
            author: population.user.id,
            draft: {},
        }).draft.save()
        .then(() => {
            return (
                Thing.db_handle('thing_event').orderBy('created_at')
            )
            .then(events => {
                assert_chai.equal(events.length, event_count);
            })
        })
    )

    promise.it("when upserting and stumbling upon already existing thing: creates a new `thing_event` when draft is not empty", () =>
        new Thing({
            type: 'resource',
            github_full_name: 'brillout/gulp-jspm',
            draft: {
                author: population.user.id,
            },
        }).draft.save()
        .then(([thing]) => {
            return (
                Thing.db_handle('thing_event').orderBy('created_at')
            )
            .then(events => {
                assert_chai.equal(events.length, ++event_count);
                const e = events.slice(-1)[0];
                assert(e.id_thing === thing.id);
                assert(e.author === population.user.id);
                assert_chai.equal(Object.keys(e.json_data).length, 0);
            })
        })
    )

    promise.it("when upserting and stumbling upon new thing: not only saves `draft` in a new `thing_event` row but also properties defined on `thing`", () =>
        new Thing({
            type: 'resource',
            github_full_name: 'brillout/doesnt-exist',
            draft: {
                author: population.user.id,
            },
        }).draft.save()
        .then(([thing]) => {
            return (
                Thing.db_handle('thing_event').orderBy('created_at')
            )
            .then(events => {
                assert_chai.equal(events.length, ++event_count);
                const e = events.slice(-1)[0];
                assert(e.id_thing === thing.id);
                assert(e.author === population.user.id);
                assert(! e.json_data.github_info);
                assert(e.json_data.github_full_name==='brillout/doesnt-exist');
                assert_chai.equal(Object.keys(e.json_data).length, 1);
            })
        })
    )

    promise.it("when upserting and stumbling upon new thing: automatically populates draft to create a new `thing_event` even if draft is empty", () =>
        new Thing({
            type: 'resource',
            github_full_name: 'brillout/doesnt-exist-2',
            author: population.user.id,
            draft: {},
        }).draft.save()
        .then(([thing]) => {
            return (
                Thing.db_handle('thing_event').orderBy('created_at')
            )
            .then(events => {
                assert_chai.equal(events.length, ++event_count);
                const e = events.slice(-1)[0];
                assert(e.id_thing === thing.id);
                assert(e.author === population.user.id);
                assert(! e.json_data.github_info);
                assert(e.json_data.github_full_name==='brillout/doesnt-exist-2');
                assert_chai.equal(Object.keys(e.json_data).length, 1);
            })
        })
    )

    promise.it("can also upsert users", () =>
        new Thing({
            type: 'user',
            github_login: 'devarchy-bot',
            draft: {},
        }).draft.save()
        .then(([thing]) => {
            assert(thing.author === thing.id);
            return (
                Thing.db_handle('thing_event').orderBy('created_at')
            )
            .then(events => {
                assert_chai.equal(events.length, ++event_count);
                const e = events.slice(-1)[0];
                assert(! e.json_data.github_info);
                assert(e.id_thing === thing.id);
                assert(e.author === thing.id);
                assert(e.json_data.github_login==='devarchy-bot');
                assert_chai.equal(Object.keys(e.json_data).length, 1);
            })
        })
    )

});
