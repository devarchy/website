"use strict";
require('mocha');
const assert = require('better-assert');
const Thing = require('../thing').custom_schema(schema(), 'cascading_save');
const setup = require('../setup')(Thing);
const promise = require('../../test-promise')(Thing);
const Promise = require('bluebird'); Promise.longStackTraces();

let author;

describe("ThingDB - cascading saving", () => {
    before(setup);

    before(create_user);

    promise.it("can save cascades of arbitrary length", () => (
        new Thing({
            author,
            type: 'link_c',
            str: 'Brillout',
        }).draft.save()
        .then(([thing__link_c]) => {
            assert(thing__link_c.str_full==='Brillout');
            return (
                new Thing({
                    author,
                    type: 'link_b',
                    str: 'Romuald',
                    referred_link_c: thing__link_c.id,
                }).draft.save()
                .then(things => {
                    assert(things.length===2);
                    const [thing__link_b, thing__link_c] = things;
                    assert(thing__link_b.type==='link_b');
                    assert(thing__link_c.type==='link_c');
                    assert(thing__link_c.str_full==='Romuald Brillout');
                    return (
                        new Thing({
                            author,
                            type: 'link_a',
                            str: 'Engineer',
                            referred_link_b: thing__link_b.id,
                        }).draft.save()
                        .then(things => {
                            assert(things.length===3);
                            const [thing__link_a, thing__link_b, thing__link_c] = things;
                            assert(thing__link_a.type==='link_a');
                            assert(thing__link_b.type==='link_b');
                            assert(thing__link_c.type==='link_c');
                            assert(thing__link_c.str_full==='Engineer Romuald Brillout');
                        })
                    );
                })
            );
        })
    ));
});

function schema() {
    return {
        link_a: {
            str: {
                validation: {
                    type: String,
                },
                is_unique: true,
            },
            referred_link_b: {
                validation: {
                    type: 'Thing.link_b',
                },
                cascade_save: true,
            },
        },
        link_b: {
            str: {
                validation: {
                    type: String,
                },
                is_unique: true,
            },
            referred_link_c: {
                validation: {
                    type: 'Thing.link_c',
                },
                cascade_save: {
                    transitive_cascade: true,
                },
            },
        },
        link_c: {
            str: {
                validation: {
                    type: String,
                },
                is_unique: true,
            },
            str_full: {
                validation: {
                    type: String,
                },
                value: (thing_self, {Thing, transaction}) => {
                    let str_full = thing_self.str;
                    return (
                        Thing.database.load.things({
                            type: 'link_b',
                            referred_link_c: thing_self.id,
                        }, {transaction})
                        .then(([link_b]) => {
                            if( link_b ) {
                                str_full = link_b.str+' '+str_full;
                                return (
                                    Thing.database.load.things({
                                        type: 'link_a',
                                        referred_link_b: link_b.id,
                                    }, {transaction})
                                    .then(([link_a]) => {
                                        if( link_a ) {
                                            str_full = link_a.str+' '+str_full;
                                        }
                                    })
                                );
                            }
                        })
                        .then(() => str_full)
                    );
                },
                is_async: true,
            }
        },
        user: {
            name: {
                validation: {
                    type: String,
                },
                is_unique: true,
            },
        },
    };
}

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
