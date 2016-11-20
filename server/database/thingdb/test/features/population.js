"use strict";
const assert = require('better-assert');
const Thing = require('./thing');


const population = module.exports = {
    user: null,
    resource: null,
    create,
};


let promise;
function create(done) {

    this.timeout(1000);
 // this.timeout(30*1000);

    if( !promise ) { promise = create_promise(); }
    promise
    .then(() => done())
    .catch(err => done(err));

    return;

    function create_promise() {
        return (
            create_user()
        )
        .then(() =>
            Promise.all([
                create_resource(),
            ])
        );
    }

    function create_user() {
        return (
            new Thing({
                type: 'user',
                name: 'A Bot User',
                draft: {},
            })
            .draft.save()
            .then(([user]) => {
                assert(user);
                assert(user.id);
                population.user = user;
            })
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
            .draft.save()
            .then(([resource]) => {
                assert(resource);
                population.resource = resource;
            })
        );
    }

}
