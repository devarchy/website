"use strict";
require('../setup');
require('mocha');
const assert = require('better-assert');
const promise = require('../test-promise')();
const Thing = require('../../index.js');
const population = require('../population');


describe('ThingDB Validation on uniqueness', () => {

    before(population.create);

    promise.it_validates_if('trying to create already exisiting user', () => {
            const user = new Thing({
                type: 'user',
                draft: {
                    github_login: population.user.github_login,
                },
            });
            user.draft.author = user.id;
            return user.draft.save();
        },
        { reason: 'Thing with type `user` and github_login `brillout` already exists in database' }
    );

    promise.it_validates_if(
        'trying to create two `tagging` things with same referred_thing and referred_resource',
        () =>
            new Thing({
                type: 'tagged',
                draft: {
                    referred_resource: population.resource.id,
                    referred_tag: population.tag.id,
                    removed: false,
                    author: population.user.id,
                },
            }).draft.save(),
        { reason: 'already exists' }
    );
});
