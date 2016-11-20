"use strict";
require('mocha');
const assert = require('better-assert');
const assert_chai = require('chai').assert;
const Thing = require('../thing')
require('../../setup')(Thing);
const promise = require('../../test-promise')(Thing);
const population = require('../population');


describe("ThingDB's upsert support", () => {

    before(population.create);

    promise.it("can upsert a thing with a computed property with `is_unique`", () => {
        const name_normalized = population.resource.name_normalized;

        return (
            assert_number_of_resources({number: 1, name_normalized})
        )
        .then(() =>
            new Thing({
                type: 'resource',
                author: population.user.id,
                name: population.resource.name+'!',
                draft: {},
            })
            .draft.save()
            .then(([resource]) => {
                assert(resource.name_normalized===name_normalized);
                assert(resource.name===population.resource.name+'!');
            })
        )
        .then(() =>
            assert_number_of_resources({number: 1, name_normalized})
        );

    });

    promise.it("can handle a missing required property and still ...", () =>
        // which is tricky for a computed value that relies upon this required property
        (
            assert_number_of_resources({number: 1})
        )
        .then(() =>
            new Thing({
                type: 'resource',
                author: population.user.id,
                url: population.resource.url,
                serial_number: population.resource.serial_number+'6',
                draft: {},
            })
            .draft.save()
            .then(([resource]) => {
                assert(resource.serial_number===population.resource.serial_number+'6');
                population.resource = resource;
            })
        )
        .then(() =>
            assert_number_of_resources({number: 1})
        )
    )

    promise.it_validates_if("no corresponding thing has been found", () =>
        new Thing({
            type: 'resource',
            author: population.user.id,
            url: "http://example.org/doesnt-exist/",
            serial_number: population.resource.serial_number+'7',
            draft: {},
        })
        .draft.save(),
        { reason: 'property `name` is missing but according to schema it is required' }
    );

    promise.it("can handle several `is_unique` properties", () =>
        (
            assert_number_of_resources({number: 1})
        )
        .then(() =>
            new Thing({
                type: 'resource',
                author: population.user.id,
                url: population.resource.url+'/a-page',
                serial_number: population.resource.serial_number,
                draft: {},
            })
            .draft.save()
            .then(([resource]) => {
                assert(resource.url===population.resource.url+'/a-page');
                assert(resource.serial_number===population.resource.serial_number);
                population.resource = resource;
            })
        )
        .then(() =>
            assert_number_of_resources({number: 1})
        )
    )

    promise.it_validates_if("several `is_unique` properties update are conflicting", () =>
        new Thing({
            type: 'resource',
            author: population.user.id,
            url: "http://example.org/another-page/",
            serial_number: population.resource.serial_number,
            draft: {},
        }).draft.save()
        ,
        {
            before: () =>
                (
                    assert_number_of_resources({number: 1})
                )
                .then(() =>
                    new Thing({
                        type: 'resource',
                        author: population.user.id,
                        name: 'A resource '+Math.random(),
                        url: "http://example.org/another-page/",
                        serial_number: population.resource.serial_number+'7',
                        draft: {},
                    }).draft.save()
                )
                .then(() =>
                    assert_number_of_resources({number: 2})
                )
            ,
            reason: 'Upserting following thing will lead to violation of `is_unique` constraint',
        }
    );

});


function assert_number_of_resources({name_normalized=population.resource.name_normalized, number}={}) {
    return (
        Thing.database.load.things({
            type: 'resource',
            name_normalized,
        })
    )
    .then(resources => {
        assert_chai.equal(number, resources.length);
    });
}
