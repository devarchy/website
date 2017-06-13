"use strict";
require('mocha');
const Thing = require('../thing').Thing;
const setup = require('../setup')(Thing);
const promise = require('../../test-promise')(Thing);
const population = require('../population');


describe('ThingDB Validation', () => {
    before(setup);
    before(population.create);

    promise.it_validates_if("type of Thing isn't defined in schema", () =>
        new Thing({
            type: 'nonexistingtype',
            draft: {
                author: population.user.id,
                name: "A resource's name",
            },
        }).draft.save(),
        { reason: 'type `nonexistingtype` is missing a schema' }
    );

    promise.it_validates_if("property of a Thing isn't defined in schema", () =>
        new Thing({
            type: 'resource',
            draft: {
                author: population.user.id,
                nonexistingpropi: 'testing non existing prop',
                name: "A resource's name",
            },
        }).draft.save(),
        { reason: 'property `nonexistingpropi` found but it is not defined in the schema' }
    );

    promise.it_validates_if("property of a Thing is set to undefined", () =>
        new Thing({
            type: 'resource',
            name: 'rewurhi',
            draft: {
                serial_number: undefined,
                author: population.user.id,
            },
        }).draft.save(),
        { reason: 'property `serial_number` is equal to `undefined` which is forbidden' }
    );

    promise.it_validates_if("upserted property of a Thing is set to undefined", () =>
        new Thing({
            type: 'resource',
            name: 'rewurhi',
            serial_number: undefined,
            draft: {
                author: population.user.id,
            },
        }).draft.save(),
        { reason: '`serial_number` equals to `undefined` which is forbidden' }
    );

    promise.it_validates_if("author is missing", () =>
        new Thing({
            type: 'resource',
            draft: {
                name: "A resource's name",
            },
        }).draft.save(),
        { reason: 'author is always required' }
    );

    promise.it_validates_if("a required property is missing", () =>
        new Thing({
            type: 'resource',
            draft: {
                author: population.user.id,
            },
        }).draft.save(),
        { reason: 'property `name` is missing but according to schema it is required'}
    );

    promise.it_validates_if("all properties of a required set are missing", () =>
        new Thing({
            type: 'user',
            draft: {
                author: population.user.id,
                bio: 'a bio',
            },
        }).draft.save(),
        { reason: "all of `[name,url]` are missing but one of them shouldn't be"}
    );

    promise.it_validates_if('required nested property is missing', () =>
        new Thing({
            type: 'tag',
            draft: {
                author: population.user.id,
                name: 'a test tag'+Math.random(),
                info: {
                    wronprop: 'test',
                },
            },
        }).draft.save(),
        { reason: 'proprety `url` of `info` is missing but it is required' }
    );
    promise.it_validates_if("a schema[type][prop].validation.test is failing", () =>
        new Thing({
            type: 'resource',
            draft: {
                author: population.user.id,
                name: "A resource's name",
                url: 'ftp://brillout.com',
            },
        }).draft.save(),
        { reason: 'failed validation test' }
    );

    promise.it_validates_if("trying to change immutable tagged's property referred_tag", () =>
        new Thing({
            type: 'tagged',
            id: population.taggeds[0].id,
            draft: {
                referred_tag: population.tags.slice(-1)[0].id,
                author: population.user.id,
            },
        }).draft.save(),
        { reason: 'trying to alter immutable property `referred_tag`' }
    );

    promise.it("but still allows creation of previous things when all is good", () =>
        Promise.all([
            new Thing({
                type: 'user',
                draft: {
                    author: population.user.id,
                    url: 'http//brillout.com',
                    bio: 'a bio',
                },
            }).draft.save(),
            new Thing({
                type: 'resource',
                draft: {
                    author: population.user.id,
                    name: "A resource's name",
                },
            }).draft.save(),
            new Thing({
                type: 'tag',
                draft: {
                    author: population.user.id,
                    name: 'a test tag'+Math.random(),
                    info: {
                        wronprop: 'test',
                        url: "http://example.org",
                    },
                },
            }).draft.save(),
            /*
            new Thing({
                type: 'tagged',
                id: population.taggeds[0].id,
                draft: {
                    referred_tag: population.taggeds[0].referred_tag,
                    author: population.user.id,
                },
            }).draft.save(),
            */
        ])
    );

    /* TODO
    promise.it_validates_if("a property is unknown when loading things", () =>
        Thing.database.load.view([{
            nonexistingpropiprop: '1234',
        }]),
        { reason: 'property `nonexistingpropi` found but it is not defined in the schema' }
    ); 
    */
});
