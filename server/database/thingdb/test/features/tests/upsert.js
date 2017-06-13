"use strict";
require('mocha');
const assert = require('better-assert');
const assert_chai = require('chai').assert;
const Thing = require('../thing').Thing;
const setup = require('../setup')(Thing);
const promise = require('../../test-promise')(Thing);
const population = require('../population');


describe("ThingDB's upsert support", () => {
    before(setup);

    before(population.create);

    let author;
    before(() => author = population.user.id);

    let events_count;
    let things_count;
    before(() =>
        Promise.all([
            Thing.database.load.all_things()
            .then(things => {
                things_count = things.length;
            }),
            Thing.db_handle('thing_event')
            .then(events => {
                events_count = events.length;
            }),
        ])
    );

    promise.it("when upserting and stumbling upon already existing thing: does not create a new `thing_event` when draft is empty", () =>
        (
            assert_number_of_stuff({number_of_things: things_count, number_of_events: events_count})
        )
        .then(() =>
            new Thing({
                type: 'resource',
                name: population.resource.name,
                author: population.user.id,
            }).draft.save()
        )
        .then(() =>
            assert_number_of_stuff({number_of_things: things_count, number_of_events: events_count})
        )
    )

    promise.it("when upserting and stumbling upon already existing thing: doesn't create a new `thing_event` even when draft is not empty", () =>
        new Thing({
            type: 'resource',
            name: population.resource.name,
            draft: {
                author: population.user.id,
            },
        }).draft.save()
        .then(() =>
            assert_number_of_stuff({number_of_things: things_count, number_of_events: events_count})
        )
    )

    promise.it("when upserting and stumbling upon already existing thing: updates properties by saving all draft props and only new thing props to a new event row", () => {
        const serial_number = Math.random().toString().slice(2);
        const url = 'http://example.org/'+Math.random();
        assert( serial_number !== population.resource.serial_number );
        assert( url !== population.resource.url );
        return (
            (
                assert_number_of_stuff({number_of_things: things_count, number_of_events: events_count})
            )
            .then(() =>
                new Thing({
                    type: 'resource',
                    name: population.resource.name,
                    serial_number,
                    author: population.user.id,
                    draft: {
                        url,
                    },
                }).draft.save()
            )
            .then(([resource]) => {
                assert(resource.id === population.resource.id);
                assert(resource.name === population.resource.name);
                assert(resource.serial_number === serial_number);
                assert(resource.url === url);
                return resource;
            })
            .then(resource =>
                (
                    Thing.db_handle('thing_event').orderBy('created_at', 'desc')
                )
                .then(([ev]) => {
                    assert(ev.id_thing === resource.id);
                    assert(ev.author === population.user.id);
                    assert(ev.json_data.serial_number === serial_number);
                    assert(ev.json_data.url === url);
                    assert_chai.equal(Object.keys(ev.json_data).length, 2);
                })
            )
            .then(() =>
                assert_number_of_stuff({number_of_things: things_count, number_of_events: ++events_count})
            )
            .then(() =>
                new Thing({
                    type: 'resource',
                    name: population.resource.name,
                    serial_number: serial_number+'123',
                    author: population.user.id,
                    url,
                }).draft.save()
            )
            .then(([resource]) =>
                (
                    Thing.db_handle('thing_event').orderBy('created_at', 'desc')
                )
                .then(([ev]) => {
                    assert(ev.json_data.serial_number === serial_number+'123');
                    assert_chai.equal(Object.keys(ev.json_data).length, 1);
                })
            )
            .then(() =>
                assert_number_of_stuff({number_of_things: things_count, number_of_events: ++events_count})
            )
            .then(() =>
                new Thing({
                    type: 'resource',
                    name: population.resource.name,
                    serial_number: serial_number+'456',
                    author: population.user.id,
                    draft: {
                        url,
                    },
                }).draft.save()
            )
            .then(([resource]) =>
                (
                    Thing.db_handle('thing_event').orderBy('created_at', 'desc')
                )
                .then(([ev]) => {
                    assert(ev.id_thing = resource);
                    assert(ev.json_data.serial_number === serial_number+'456');
                    assert(ev.json_data.url === url);
                    assert_chai.equal(Object.keys(ev.json_data).length, 2);
                })
                .then(() => {
                    population.resource = resource;
                })
            )
            .then(() =>
                assert_number_of_stuff({number_of_things: things_count, number_of_events: ++events_count})
            )
        );
    });

    promise.it("when upserting and stumbling upon new thing: not only saves `draft` in a new `thing_event` row but also properties defined on `thing`", () => {
        const name = 'new upi resource '+Math.random();
        const url = 'http://brillout.com/'+Math.random();
        return (
            new Thing({
                type: 'resource',
                name,
                author: population.user.id,
                draft: {
                    url,
                },
            }).draft.save()
            .then(([thing]) => {
                assert(thing.name===name);
                assert(thing.url===url);
                assert(thing.author===population.user.id);
                assert(thing.type==='resource');
                return (
                    Thing.db_handle('thing_event').orderBy('created_at', 'desc')
                )
                .then(([ev]) => {
                    assert(ev.id_thing === thing.id);
                    assert(ev.author === population.user.id);
                    assert(ev.json_data.name===name);
                    assert(ev.json_data.url===url);
                    assert_chai.equal(Object.keys(ev.json_data).length, 2);
                })
            })
            .then(() =>
                assert_number_of_stuff({number_of_things: ++things_count, number_of_events: ++events_count})
            )
        );
    })

    promise.it("can upsert a thing with a computed property with `is_unique`", () => {
        return (
            assert_number_of_stuff({number_of_things: things_count, number_of_events: events_count})
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
                assert(resource.name_normalized===population.resource.name_normalized);
                assert(resource.name===population.resource.name+'!');
            })
        )
        .then(() =>
            assert_number_of_stuff({number_of_things: things_count, number_of_events: ++events_count})
        );
    });

    promise.it("can handle a missing required property and still ...", () =>
        // which is tricky for a computed value that relies upon this required property
        (
            assert_number_of_stuff({number_of_things: things_count, number_of_events: events_count})
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
            assert_number_of_stuff({number_of_things: things_count, number_of_events: ++events_count})
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
            assert_number_of_stuff({number_of_things: things_count, number_of_events: events_count})
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
            assert_number_of_stuff({number_of_things: things_count, number_of_events: ++events_count})
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
                    assert_number_of_stuff({number_of_things: things_count, number_of_events: events_count})
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
                    assert_number_of_stuff({number_of_things: ++things_count, number_of_events: ++events_count})
                )
            ,
            reason: 'Upserting following thing will lead to violation of `is_unique` constraint',
        }
    );

    promise.it("can upsert a user without setting an author", () => {
        const name = 'A test User '+Math.random();
        return (
            assert_number_of_stuff({number_of_things: things_count, number_of_events: events_count})
        )
        .then(() =>
            new Thing({
                type: 'user',
                name,
            }).draft.save()
        )
        .then(([user]) => {
            assert(user.name===name);
        })
        .then(() =>
            assert_number_of_stuff({number_of_things: ++things_count, number_of_events: ++events_count})
        )
    });

    promise.it("can upsert with using the ID as unique key", () => {
        const url = "http://example.org/random-page/"+Math.random();
        return (
            (
                assert_number_of_stuff({number_of_things: things_count, number_of_events: events_count})
            )
            .then(() =>
                new Thing({
                    id: population.resource.id,
                    type: 'resource',
                    url,
                    author: population.user.id,
                }).draft.save()
                .then(([u]) => {
                    assert(u.url === url);
                })
            )
            .then(() =>
                assert_number_of_stuff({number_of_things: things_count, number_of_events: ++events_count})
            )
        );
    });

    promise.it_validates_if("`type` is missing when upserting with ID", () => {
        const url = "http://example.org/random-page/"+Math.random();
        return (
            new Thing({
                id: population.resource.id,
                url,
                author: population.user.id,
            }).draft.save()
            .then(([u]) => {
                assert(u.url === url);
            })
        );
    }, {reason: '`type` is required when upserting'});

    promise.it_validates_if("`author` is missing", () => {
        const url = "http://example.org/random-page/"+Math.random();
        return (
            new Thing({
                id: population.resource.id,
                type: 'resource',
                url,
            }).draft.save()
            .then(([u]) => {
                assert(u.url === url);
            })
        );
    }, {reason: 'author is always required on draft'});

    promise.it("can upsert a prop that has a default value", () => {
        const name = 'A resource '+Math.random();
        return (
            assert_number_of_stuff({number_of_things: things_count, number_of_events: events_count})
        )
        .then(() =>
            new Thing({
                author,
                type: 'resource',
                name,
            }).draft.save()
            .then(([res]) => {
                assert(res.name===name);
                assert(res.is_reviewed===false);
                return (
                    (
                        Thing.db_handle('thing_event').orderBy('created_at', 'desc')
                    )
                    .then(([ev]) => {
                        assert(ev.id_thing === res.id);
                        assert(ev.author === author);
                        assert(ev.json_data.name === name);
                        assert_chai.equal(Object.keys(ev.json_data).length, 1);
                    })
                );
            })
        )
        .then(() =>
            assert_number_of_stuff({number_of_things: ++things_count, number_of_events: ++events_count})
        )
        .then(() =>
            new Thing({
                author: population.user.id,
                type: 'resource',
                name,
                is_reviewed: false,
            }).draft.save()
            .then(([r]) => r.name===name && r.is_reviewed===false)
        )
        .then(() =>
            assert_number_of_stuff({number_of_things: things_count, number_of_events: events_count})
        )
        .then(() =>
            new Thing({
                author: population.user.id,
                type: 'resource',
                name,
                is_reviewed: true,
            }).draft.save()
            .then(([res]) => {
                assert(res.name===name);
                assert(res.is_reviewed===true);
                return (
                    (
                        Thing.db_handle('thing_event').orderBy('created_at', 'desc')
                    )
                    .then(([ev]) => {
                        assert(ev.id_thing === res.id);
                        assert(ev.author === author);
                        assert(ev.json_data.is_reviewed === true);
                        assert_chai.equal(Object.keys(ev.json_data).length, 1);
                    })
                );
            })
        )
        .then(() =>
            assert_number_of_stuff({number_of_things: things_count, number_of_events: ++events_count})
        )
    })
});


function assert_number_of_stuff({number_of_things, number_of_events}={}) {
    return (
        Promise.all([
            (
                Thing.database.load.all_things()
            )
            .then(resources => {
                assert_chai.equal(number_of_things, resources.length);
            }),
            (
                Thing.db_handle('thing_event')
            )
            .then(events => {
                assert_chai.equal(number_of_events, events.length);
            }),
        ])
    );
}
