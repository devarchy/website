"use strict";
require('mocha');
const assert = require('better-assert');
const Thing = require('../thing').Thing;
const setup = require('../setup')(Thing);
const promise = require('../../test-promise')(Thing);
const population = require('../population');


describe("ThingDB - relationships", () => {
    before(setup);

    before(population.create);

    let tag;
    let resource;

    promise.it("supports many to many relationships with a computed array", () => ( 
        Promise.all([
            new Thing({
                type: 'tag',
                name: 'fake tag',
                author: population.user.id,
                draft: {},
            }).draft.save().then(([tag_]) => tag = tag_),
            new Thing({
                type: 'resource',
                name: 'fake resource '+Math.random(),
                url: 'http://example.org/'+Math.random(),
                author: population.user.id,
                draft: {},
            }).draft.save().then(([resource_]) => resource = resource_),
        ])
        .then(() =>
            new Thing({
                type: 'tagged',
                referred_tag: tag.id,
                referred_resource: resource.id,
                author: population.user.id,
                draft: {},
            })
            .draft.save()
            .then(() =>
                Thing.database.load.things({
                    type: 'resource',
                    tags: [tag.name],
                })
                .then(things => {
                    assert(things.length === 1);
                    assert(check_for_resource(things));
                })
            )
        )
    )); 

    promise.it("supports many to many relationships with view feature", () => ( 
        Thing.database.load.view([{
            type: 'tag',
            name: tag.name,
        }])
        .then(things => {
            assert(check_for_resource(things));
            assert(things.length===4);
            assert(['user', 'resource', 'tag', 'tagged'].every(type => things.filter(t => t.type === type).length===1));
        })
    )); 

    promise.it("can remove relationship", () => ( 
        Thing.database.load.view([{
            type: 'tag',
            name: tag.name,
        }])
        .then(things => {
            assert( check_for_resource(things) );
        })
        .then(() =>
            new Thing({
                type: 'tagged',
                referred_resource: resource.id,
                referred_tag: tag.id,
                draft: {
                    is_removed: true,
                    author: population.user.id,
                },
            }).draft.save()
        )
        .then(() =>
            Thing.database.load.view([{
                type: 'tag',
                name: tag.name,
            }])
        )
        .then(things => {
            assert( check_for_resource(things)===undefined );
        })
        .then(() =>
            Thing.database.load.things({
                type: 'resource',
                tags: [tag.name],
            })
        )
        .then(things => {
            assert( check_for_resource(things)===undefined );
        })
    )); 

    promise.it("can re-add relationship", () => ( 
        (
            Thing.database.load.view([{
                type: 'tag',
                name: tag.name,
            }])
        )
        .then(things => {
            assert( check_for_resource(things)===undefined );
        })
        .then(() =>
            new Thing({
                type: 'tagged',
                referred_resource: resource.id,
                referred_tag: tag.id,
                draft: {
                    is_removed: false,
                    author: population.user.id,
                },
            }).draft.save()
        )
        .then(() =>
            Thing.database.load.view([{
                type: 'tag',
                name: tag.name,
            }])
        )
        .then(things => {
            assert( check_for_resource(things) );
        })
        .then(() =>
            Thing.database.load.things({
                type: 'resource',
                tags: [tag.name],
            })
        )
        .then(things => {
            assert( check_for_resource(things) );
        })
    )); 

    return;

    function check_for_resource(things) { 
        const resource_ = things.find(({id}) => id === resource.id);
        if( resource_ ) {
            assert(resource_.tags.length === 1);
            assert(resource_.tags[0] === tag.name);
            assert(resource_.url = resource.url);
            assert(resource_.name = resource.name);
            assert(resource_.name_normalized = resource.name_normalized);
        }
        return resource_;
    } 

});
