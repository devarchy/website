"use strict";
require('mocha');
const assert_better = require('better-assert');
const assert = require('assert');
const Thing = require('../thing').custom_schema(schema(), 'computed_props');
const setup = require('../setup')(Thing);
const promise = require('../../test-promise')(Thing);

let author;

describe("ThingDB - computed properties", () => {
    before(setup);

    before(create_user);

    promise.it("supports synchronous computed properties", () => { 
        return (
            new Thing({
                type: 'resource',
                draft: {
                    url: 'http://brillout.com',
                    author,
                },
            }).draft.save()
            .then(([resource]) => {
                assert_better(resource.url_normalized === 'brillout.com');
            })
        );
    }); 

    promise.it("supports asynchronous computed properties", () => { 
        const url = 'http://brillout.com';
        return (
            new Thing({
                type: 'resource',
                url,
                author,
                draft: {},
            }).draft.save()
            .then(([resource]) => {
                assert_better(resource.url_information.fake_info === url+'/pathi');
            })
        );
    }); 
});

function create_user() { 
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
            url: {
                validation: {
                    type: String,
                },
                is_unique: true,
            },
            url_normalized: {
                validation: {
                    type: String,
                },
                value: (thing_self, args) => {
                    assert_args(thing_self, args);
                    return thing_self.url.replace(/https?:\/\//,'');
                },
            },
            url_information: {
                validation: {
                    type: Object,
                },
                is_async: true,
                value: (thing_self, args) => {
                    assert_args(thing_self, args);
                    return (
                        new Promise(resolve => {
                            setTimeout(() => {
                                resolve({fake_info: thing_self.url+'/pathi'});
                            }, 300);
                        })
                    );
                },
            }
        },
    };

    function assert_args(thing_self, args) {
        assert_better(thing_self);
        assert_better(thing_self.constructor === Object);
        assert_better(thing_self.id);
        assert_better(args.Thing);
        assert_better(args.Thing===Thing);
        assert_better(args.transaction);
        assert_better(args.transaction.rid);
        assert((args.schema__args||1).constructor===Object, JSON.stringify(args));
        assert_better(Object.keys(args).length===3);
    }
} 
