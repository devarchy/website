"use strict";
require('../setup');
require('mocha');
const assert = require('better-assert');
const promise = require('../test-promise')();
const Thing = require('../../index.js');
const population = require('../population');


describe('ThingDB Validation', () => {

    before(population.create);

    let things_total_count;

    /* not currently using required_props
    promise.it_validates_if('required nested property is missing', () => {
            const user = new Thing({
                type: 'user',
                draft: {
                    github_info: {
                        login: "brillout-clone",
                        // missing `id`
                    },
                },
            });
            user.draft.author = user.id;
            return user.draft.save();
        },
        { reason: 'proprety `id` of `github_info` is missing but it is required' }
    );

    promise.it("but still allows creation when missing property is present", () =>
        (() => {
            const user = new Thing({
                type: 'user',
                draft: {
                    github_info: {
                        login: "brillout-clone",
                        id: "13523258",
                    },
                },
            });
            user.draft.author = user.id;
            return user.draft.save();
        })()
        .then(() =>
            Thing.database.load.things({
                name: 'github:brillout-clone',
                type: 'user',
            })
        )
        .then(users => {
            assert( users.length === 1 );
            assert( users[0].name === 'github:brillout-clone' );
            assert( users[0].id );
        })
    );
    */

    promise.it_validates_if("schema[type] is missing", () =>
        new Thing({
            type: 'nonexistingtype',
            draft: {
                name: 'a-new-tag',
                author: population.user.id,
                definition: 'some new tag',
            },
        }).draft.save(),
        { reason: 'thing has type `nonexistingtype` but no schema for `nonexistingtype` has been provided' }
    );

    promise.it_validates_if("author is missing", () =>
        new Thing({
            type: 'tag',
            draft: {
                name: 'a-new-tag',
                // author is missing
                definition: 'some new tag',
            },
        }).draft.save(),
        { reason: 'author is always required' }
    );

    promise.it_validates_if("a required property is missing", () =>
        new Thing({
            type: 'tag',
            draft: {
                // name is missing
                author: population.user.id,
                definition: 'some new tag',
            },
        }).draft.save(),
        { reason: 'property `name` is missing but according to schema it is required'}
    );

    promise.it_validates_if("a schema[type][prop].validation.test is failing", () =>
        new Thing({
            type: 'tag',
            draft: {
                name: 'a-new tag', // whitespace are not allowed
                author: population.user.id,
                definition: 'some new tag',
            },
        }).draft.save(),
        { reason: 'failed validation test' }
    );

    let tag;
    promise.it("but still allows creation when complying with schema", () => {
        tag = new Thing({
            type: 'tag',
            draft: {
                name: 'a-new-tag',
                author: population.user.id,
                definition: 'some new tag',
            },
        });
        return tag.draft.save();
    });

    promise.it_validates_if("trying to save a draft without author", () =>
        new Thing({
            type: tag.type,
            name: tag.name,
            draft: {
                definition: tag.definition,
            },
        }).draft.save(),
        { reason: 'author is always required', }
    );

    promise.it_validates_if("trying to change immutable tagged's property referred_tag", () =>
        Thing.database.load.things({type: 'tagged', referred_tag: population.tag.id})
        .then(things => { assert(things[0]); return things[0] })
        .then(tagged =>
            new Thing({
                id: tagged.id,
                draft: {
                    referred_tag: population.tag2.id,
                    author: population.user.id,
                },
            }).draft.save()
        ),
        { reason: 'trying to alter immutable property `referred_tag`' }
    );
});

/* TODO implement this feature with Proxy once Node.js is using v8 4.9
const Promise = require('bluebird');
Promise.longStackTraces();
describe('ThingDB throws an error as soon as creating a wrong property', () => {
    promise.it_validates_if('setting unspecified property', () =>
        new Promise((resolve, reject) => {
            const resource = new Thing({
              type: 'resource',
            });
            resource.non_existing_prop = 0;
            setTimeout(() => {resolve()}, 2000);
        })
        .then(() => {
            assert( false );
        })
        .catch(err => {
            assert(err.constructor === Thing.ValidationError);
        })
    );
})
*/
