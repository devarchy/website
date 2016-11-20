"use strict";
const assert = require('better-assert');
const Thing = require('./thing');


const population = module.exports = {
    user: null,
    resource: null,
    resources: [],
    tag: null,
    tag2: null,
    tagged: null,
    create,
};


let promise;
function create(done) {

    this.timeout(30*1000);

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
                create_resources(),
                create_resource(),
                create_tags(),
            ])
            .then( () =>
                create_tagged()
            )
        );

        assert(false);

        function create_user() { 
            // upserting a user is currently not possible
            return Thing.database.load.things({type: 'user', github_login: 'brillout'})
            .then(things => {
                if( things.length === 1 ) {
                    population.user = things[0];
                    return;
                }
                assert( things.length === 0 );
                const user = new Thing({
                    type: 'user',
                    draft: {
                        github_login: 'brillout',
                    },
                });
                user.draft.author = user.id;
                population.user = user;
                return user.draft.save();
            })
        } 

        function create_resource() { 
            return (() => {
                population.resource = new Thing({
                    type: 'resource',
                    github_full_name: 'brillout/gulp-jspm',
                    draft: {
                        removed: false,
                        author: population.user.id,
                    },
                });
                population.resources.push(population.resource);
                return population.resource.draft.save()
            })();
        } 

        function create_resources() { 
            return Promise.all(
                [
                    'brillout/untrusted-shared-cache',
                    'brillout/inspect-browser-cache-duplication',
                    'brillout/fasterweb',
                ].map(github_full_name => {
                    const resource = new Thing({
                        type: 'resource',
                        github_full_name,
                        draft: {
                            removed: false,
                            author: population.user.id,
                        },
                    });
                    population.resources.push(resource);
                    return resource.draft.save();
                })
            )
        } 

        function create_tags() { 
            return Promise.all([
                (() => {
                    const tag = new Thing({
                        type: 'tag',
                        name: 'a-tag',
                        draft: {
                            author: population.user.id,
                            definition: 'example tag',
                        },
                    });
                    population.tag = tag;
                    return tag.draft.save()
                })(),
                (() => {
                    const tag2 = new Thing({
                        type: 'tag',
                        name: 'another-tag',
                        draft: {
                            author: population.user.id,
                            definition: 'example tag',
                        },
                    });
                    population.tag2 = tag2;
                    return tag2.draft.save()
                })(),
            ]);
        } 

        function create_tagged() { 
                return new Thing({
                    type: 'tagged',
                    referred_resource: population.resource.id,
                    referred_tag: population.tag.id,
                    removed: false,
                    draft: {
                        author: population.user.id,
                    },
                }).draft.save()
        } 
    }
}
