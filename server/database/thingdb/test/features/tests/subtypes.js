"use strict";
require('mocha');
const assert = require('better-assert');
const Thing = require('../thing').custom_schema(schema(), 'subtypes');
const setup = require('../setup')(Thing);
const promise = require('../../test-promise')(Thing);
const Promise = require('bluebird'); Promise.longStackTraces();

let author;

describe("ThingDB - subtypes", () => {
    before(setup);

    before(create_user);

    let resource;
    promise.it("automatically recognize right subtype", () => { 
        const type = 'resource';
        const url = 'http://example.org';
        const youtube_id = 'fake1d';
        return (
            Promise.all([
                (
                    new Thing({
                        type,
                        draft: {
                            url,
                            author,
                            name: 'a website',
                        },
                    }).draft.save()
                    .then(([resource_]) => {
                        resource = resource_;
                        assert(resource.type === type);
                        assert(resource.url === url);
                        assert(resource.name === 'a website');
                        assert(resource.subtype === 'website');
                    })
                ),
                (
                    new Thing({
                        type,
                        draft: {
                            youtube_id,
                            author,
                            name: 'a yt vid',
                        },
                    }).draft.save()
                    .then(([resource]) => {
                        assert(resource.type === type);
                        assert(resource.youtube_id === youtube_id);
                        assert(resource.name === 'a yt vid');
                        assert(resource.subtype === 'youtube_video');
                    })
                ),
            ])
        );
    }); 

    promise.it_validates_if("thing doesn't define a required prop of at least one subtype",
        () => ( 
            new Thing({
                type: 'resource',
                draft: {
                    author,
                    name: 'a website',
                },
            }).draft.save()
        ), 
        {reason: "Couldn\'t find subtype"}
    ); 

    /* TODO re-implement that test
    promise.it_validates_if("thing defines properties over more than one subtype",
        () => ( 
            new Thing({
                type: 'resource',
                draft: {
                    url: 'http://example.org',
                    youtube_id: '123',
                    author,
                    name: 'a website',
                },
            }).draft.save()
        ), 
        {reason: "Following thing can\'t be in several subtypes"}
    ); 
    */

    /* TODO: implement feature
    promise.it("doesn't throw a validation error if can't determine subtype while upserting with an ID", () => { 
        const name = 'New Name '+Math.random();
        return (
            new Thing({
                author,
                type: 'resource',
                id: resource.id,
                name,
            }).draft.save()
            .then(things => {
                assert(things.length===1);
                assert(things[0].id===resource.id);
                assert(things[0].name===name)
            })
        );
    }); 
    */
});

function create_user() { 
    this.timeout(5000);
    return (
        new Thing({
            type: 'user',
            name: 'fake user',
        }).draft.save()
        .then(([user]) => {
            author = user.id;
        })
    );
} 

function schema() { 
    return {
        user: {
            name: {
                validation: {
                    type: String,
                },
                is_unique: true,
            },
        },
        resource: {
            name: {
                validation: {
                    type: String,
                },
                is_unique: true,
            },
            _subtypes: {
                website: {
                    url: {
                        validation: {
                            type: String,
                        },
                        is_required: true,
                        is_unique: true,
                    },
                },
                youtube_video: {
                    youtube_id: {
                        validation: {
                            type: String,
                        },
                        is_required: true,
                        is_unique: true,
                    },
                },
            },
        },
    };
} 
