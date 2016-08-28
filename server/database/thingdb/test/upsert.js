"use strict";
require('./setup');
require('mocha');
const assert = require('better-assert');
const Thing = require('../index.js')
const chai_assert = require('chai').assert;
const promise = require('./test-promise')();
const connection = require('../database/connection');
const population = require('./population');


describe("ThingDB supports upserts", () => {

    before(population.create);

    let event_count;
    before(done => {
        const knex = connection();
        knex('thing_event')
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
            const knex = connection();
            return (
                knex('thing_event').orderBy('created_at')
            )
            .then(events => {
                chai_assert.equal(events.length, ++event_count);
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
            const knex = connection();
            return (
                knex('thing_event').orderBy('created_at')
            )
            .then(events => {
                chai_assert.equal(events.length, event_count);
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
            const knex = connection();
            return (
                knex('thing_event').orderBy('created_at')
            )
            .then(events => {
                chai_assert.equal(events.length, ++event_count);
                const e = events.slice(-1)[0];
                assert(e.id_thing === thing.id);
                assert(e.author === population.user.id);
                chai_assert.equal(Object.keys(e.json_data).length, 0);
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
            const knex = connection();
            return (
                knex('thing_event').orderBy('created_at')
            )
            .then(events => {
                chai_assert.equal(events.length, ++event_count);
                const e = events.slice(-1)[0];
                assert(e.id_thing === thing.id);
                assert(e.author === population.user.id);
                assert(! e.json_data.github_info);
                assert(e.json_data.github_full_name==='brillout/doesnt-exist');
                chai_assert.equal(Object.keys(e.json_data).length, 1);
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
            const knex = connection();
            return (
                knex('thing_event').orderBy('created_at')
            )
            .then(events => {
                chai_assert.equal(events.length, ++event_count);
                const e = events.slice(-1)[0];
                assert(e.id_thing === thing.id);
                assert(e.author === population.user.id);
                assert(! e.json_data.github_info);
                assert(e.json_data.github_full_name==='brillout/doesnt-exist-2');
                chai_assert.equal(Object.keys(e.json_data).length, 1);
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
            const knex = connection();
            return (
                knex('thing_event').orderBy('created_at')
            )
            .then(events => {
                chai_assert.equal(events.length, ++event_count);
                const e = events.slice(-1)[0];
                assert(! e.json_data.github_info);
                assert(e.id_thing === thing.id);
                assert(e.author === thing.id);
                assert(e.json_data.github_login==='devarchy-bot');
                chai_assert.equal(Object.keys(e.json_data).length, 1);
            })
        })
    )

});
