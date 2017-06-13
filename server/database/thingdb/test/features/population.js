"use strict";
const assert = require('better-assert');
const Thing = require('./thing').Thing;


const population = module.exports = {
    user: null,
    resource: null,
    resources: null,
    tags: null,
    taggeds: null,
    create: create_all,
    create_all: create_all,
    create_user: create_user,
    /*
    create: wrap(create_all),
    create_all: wrap(create_all),
    create_user: wrap(create_user),
    */
};

function wrap(fct) {
    return function() {
        return fct.apply(this, arguments);
    };
}

function create_all() {

    if( this && this.timeout ) {
        this.timeout(10*1000);
    }

    return (
        create_promise()
    );

    function create_promise() {
        return (
            (
                create_user()
            )
            .then(() =>
                Promise.all([
                    create_resource(),
                    create_resources(),
                    create_tags(),
                ])
            )
            .then(() =>
                create_taggeds()
            )
        );
    }

    function create_resource() {
        return (
            new Thing({
                type: 'resource',
                name: 'A test Resource',
                url: 'http://example.org',
                author: population.user.id,
                serial_number: '12345',
                draft: {},
            })
            .draft.save_draft()
            .then(({things_matched: [resource]}) => {
                assert(resource);
                population.resource = resource;
            })
        );
    }

    function create_resources() {
        population.resources = [];
        return (
            Promise.all(
                Array.apply(null, {length: 5})
                .map(() =>
                    create_random_resource()
                    .then(({things_matched: [resource]}) => {
                        assert(resource);
                        assert(resource.type==='resource');
                        population.resources.push(resource);
                    })
                )
            )
        );
    }

    function create_tags() {
        population.tags = [];
        return (
            Promise.all(
                Array.apply(null, {length: 5})
                .map(() =>
                    create_random_tag()
                    .then(({things_matched: [tag]}) => {
                        assert(tag);
                        assert(tag.type==='tag');
                        population.tags.push(tag);
                    })
                )
            )
        );
    }

    function create_taggeds() {
        population.taggeds = [];
        return (
            new Thing({
                type: 'tagged',
                author: population.user.id,
                referred_resource: population.resource.id,
                referred_tag: population.tags[0].id,
                draft: {},
            }).draft.save_draft()
            .then(({things_matched: [tagged]}) => {
                assert(tagged);
                population.taggeds.push(tagged);
            })
        );
    }

    function create_random_resource() {
        const rand = Math.random().toString().slice(2);
        return (
            new Thing({
                type: 'resource',
                name: 'Random resource '+rand,
                url: 'http://example.org/'+rand,
                serial_number: rand,
                author: population.user.id,
                draft: {},
            })
            .draft.save_draft()
        );
    }

    function create_random_tag() {
        const rand = Math.random().toString().slice(2);
        return (
            new Thing({
                type: 'tag',
                name: 'random tag '+rand,
                author: population.user.id,
                draft: {},
            })
            .draft.save_draft()
        );
    }
}

function create_user() {
    return (
        new Thing({
            type: 'user',
            name: 'A Bot User',
            draft: {},
        })
        .draft.save_draft()
        .then(({things_matched: [user]}) => {
            assert(user);
            assert(user.id);
            population.user = user;
        })
    );
}

