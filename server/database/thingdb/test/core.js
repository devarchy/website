"use strict";
require('./setup');
require('mocha');
const assert = require('better-assert');
const Thing = require('../index.js')
const expect = require('chai').expect;
const promise = require('./test-promise')();
const Promise = require('bluebird');
Promise.longStackTraces();


describe('ThingDB', () => {

    let user;

    promise.it('can create user, according to schema', () =>
        (() => {
            user = new Thing({
              type: 'user',
            });

            assert(user.id);

            user.draft.author = user.id;

            user.draft.github_login = 'brillout';

            return user.draft.save();
        })()
        .then(response => {
            expect( response ).to.deep.equal([user]);

            return Thing.database.load.things({
                github_login: 'brillout',
                type: 'user',
            })
        })
        .then(users => {
            assert( users.length === 1 );
            assert( users[0].type === 'user' );
            assert( users[0].github_login === 'brillout' );
        })
    );

    let resource;
    let resource2;
    promise.it('can create resources, according to schema', () =>
        Promise.all(
            [
                'brillout/untrusted-shared-cache',
                'brillout/inspect-browser-cache-duplication',
                'brillout/fasterweb',
            ].map(github_full_name =>
                new Thing({
                    type: 'resource',
                    draft: {
                        github_full_name,
                        author: user.id,
                    },
                }).draft.save()
            )
        )
        .then(resources => {
            assert( resources.length === 3 );
            resources = resources.reduce((arr, el) => arr.concat(el));
            assert( resources.every(resource => resource.constructor === Thing && resource.type === 'resource') );
            assert( resources.filter(resource => resource.github_full_name.toLowerCase() === 'brillout/fasterweb').length === 1 );
            resource =  resources[2];
            resource2 =  resources[1];
        })
        .then(() =>
            Thing.database.load.things({
                id: resource.id
            })
        )
        .then(resources => {
            assert( resources.length === 1 );
            const resource_ = resources[0];
            assert( Object.keys(resource_.github_info).length > 7 || resource_.github_info._could_not_connect );
            assert( resource_.github_full_name === 'brillout/fasterweb' );
            assert( resource_.github_info._could_not_connect || resource_.github_info.full_name === 'brillout/FasterWeb' );
        })
    );

    promise.it('can load things with filter', () =>
        (
            Thing.database.load.things({
                type: 'resource',
            })
        )
        .then(resources => {
            assert( resources.length === 3 );
            assert( resources.every(resource => resource.constructor === Thing && resource.type === 'resource') );
        })
    );

    promise.it('filter support arbitrary knex operators', () => {
        assert(resource.created_at && resource2.created_at && resource.created_at !== resource2.created_at);
        const resource_latest = resource2.created_at > resource.created_at ? resource2 : resource;
        const resource_first = resource_latest === resource2 ? resource : resource2;
        return (
            Thing.database.load.things({
                created_at: {
                    operator: '<',
                    value: resource_latest.created_at,
                },
            })
        )
        .then(things => {
            assert( things.every(t => t.id !== resource_latest.id) );
            assert( things.some(t => t.id === resource_first.id) );
        })
    });

    let tag;
    promise.it('can create tag, according to schema', () =>
        (() => {
            tag = new Thing({
                type: 'tag',
                draft: {
                    name: 'brillout-tag',
                    definition: 'definition of brillout-tag',
                    author: user.id,
                },
            });
            return tag.draft.save();
        })()
        .then(() => {
            return Thing.database.load.things({
                type: 'tag',
            })
        })
        .then(tags => {
            assert( tags.length === 1 );
            assert( tags[0].name === 'brillout-tag' );
            assert( tags[0].definition === 'definition of brillout-tag' );
        })
    );

    promise.it("can remove not required properties", () =>
        new Thing({
            type: 'tag',
            draft: {
                author: user.id,
                name: 'tag-without-definition',
                definition: 'remove me',
                title: 'remove me too',
            }
        }).draft.save()
        .then(([tag]) => {
            assert(tag.definition==='remove me');
            assert(tag.title==='remove me too');
            return tag;
        })
        .then(tag =>
            new Thing({
                type: 'tag',
                name: tag.name,
                draft: {
                    author: user.id,
                    definition: null,
                },
            }).draft.save()
        )
        .then(([tag]) => {
            assert([null, undefined].includes(tag.definition));
            assert(tag.title==='remove me too');
            return tag;
        })
        .then(tag =>
            new Thing({
                type: 'tag',
                name: tag.name,
                title: null,
                author: user.id,
                draft: {},
            }).draft.save()
        )
        .then(([tag]) => {
            assert([null, undefined].includes(tag.definition));
            assert([null, undefined].includes(tag.title));
        })
    );

    promise.it("can tag a resource and include the tag into the resource's preview", () =>
        new Thing({
            type: 'tagged',
            referred_tag: tag.id,
            referred_resource: resource.id,
            draft: {
                author: user.id,
                removed: false,
            },
        })
        .draft.save()
        .then(things => {
            var resource_updated = things.find(t => t.github_full_name === resource.github_full_name);
            assert(resource_updated);
            assert(resource_updated.preview.tags.length === 1);
            assert(resource_updated.preview.tags.includes(tag.name));
        })
    );

    promise.it('can tag resources', () =>
        (
            Thing.database.load.things({
                type: 'resource',
            })
        )
        .then(resources =>
            Promise.all(
                resources
                .map(resource => {
                    assert(tag.id);
                    assert(resource.id);
                    assert(user.id);
                    return new Thing({
                        type: 'tagged',
                        referred_tag: tag.id,
                        referred_resource: resource.id,
                        draft: {
                            author: user.id,
                            removed: false,
                        },
                    }).draft.save();
                })
            )
        )
    );

    promise.it('can view all resources that are tagged with a specific tag', () =>
        Thing.database.load.view([{
            type: 'tag',
            name: tag.name,
        }])
        .then(view_things => {
            assert(view_things.length === 8);

            const tags =
                view_things
                .filter(thing => thing.type === 'tag');
            assert(tags.length === 1);
            assert(tags[0].name === 'brillout-tag');

            const taggeds =
                view_things
                .filter(thing => thing.type === 'tagged');
            assert(taggeds.length === 3);

            const resources =
                view_things
                .filter(thing => thing.type === 'resource');
            assert(resources.length === 3);
            assert(resources.some(resource => resource.github_full_name.toLowerCase() === 'brillout/fasterweb'));
            assert(resources.some(resource => resource.github_full_name === 'brillout/untrusted-shared-cache'));
            assert(resources.some(resource => resource.github_full_name === 'brillout/inspect-browser-cache-duplication'));
        })
    );

    promise.it('returns no things when trying to have a view for a non existing tag', () =>
        // this test's purpose is to catch bug when whole database is being targeted because of `select ARRAY[11] @> ARRAY[]::integer[]`
        Thing.database.load.view([{
            type: 'tag',
            name: 'tag-i-dont-exist',
        }])
        .then(view_things => {
            assert(view_things.length === 0);
        })
    );

    promise.it("can untag a resource", () =>
        Thing.database.load.view([{
            type: 'tag',
            name: tag.name,
        }])
        .then(things => {
            assert( things.filter(t => t.id===resource.id).length === 1 );
        })
        .then(() =>
            new Thing({
                type: 'tagged',
                referred_resource: resource.id,
                referred_tag: tag.id,
                draft: {
                    removed: true,
                    author: user.id,
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
            assert( things.filter(t => t.type==='resource').length > 1 );
            assert( things.filter(t => t.id===resource.id).length === 0 );
        })
    );

    promise.it("can re-tag the resource back", () =>
        new Thing({
            type: 'tagged',
            referred_resource: resource.id,
            referred_tag: tag.id,
            draft: {
                removed: false,
                author: user.id,
            },
        }).draft.save()
        .then(() =>
            Thing.database.load.view([{
                type: 'tag',
                name: tag.name,
            }])
        )
        .then(things => {
            assert( things.filter(t => t.id===resource.id).length === 1 );
        })
    );

    promise.it("can view resources that are tagged with several given tags", () => {
        const tag2 =
            new Thing({
                type: 'tag',
                draft: {
                    name: 'tag2',
                    definition: 'definition of tag2',
                    author: user.id,
                },
            });

        return (
            tag2.draft.save()
        )
        .then(() =>
            Promise.all(
                [resource, resource2]
                .map(p =>
                    new Thing({
                        type: 'tagged',
                        referred_resource: p.id,
                        referred_tag: tag2.id,
                        draft: {
                            removed: false,
                            author: user.id,
                        },
                    }).draft.save()
                )
                .concat([
                    new Thing({
                        type: 'tagged',
                        referred_resource: resource2.id,
                        referred_tag: tag.id,
                        draft: {
                            removed: true,
                            author: user.id,
                        },
                    }).draft.save()
                ])
            )
        )
        .then(() =>
            Thing.database.load.view([
                {
                    type: 'tag',
                    name: tag.name,
                },
                {
                    type: 'tag',
                    name: tag2.name,
                },
            ])
        )
        .then(things => {
            const resources = things.filter(t => t.type==='resource');
            assert( resources.length === 1 );
            assert( resources[0].id === resource.id );
        })
        .then(things =>
            new Thing({
                type: 'tagged',
                referred_resource: resource.id,
                referred_tag: tag2.id,
                draft: {
                    removed: true,
                    author: user.id,
                },
            }).draft.save()
        )
    });

    promise.it("can view resource and its related things", () =>
        (
            Thing.database.load.view([{
                type: 'resource',
                github_full_name: resource.github_full_name,
            }])
        )
        .then(things => {
            assert( things.some(thing => thing.id === resource.id && thing.github_full_name === resource.github_full_name) );
            assert( things.some(thing => thing.id === resource.author) );
            assert( things.some(thing => thing.type === 'tagged') );
            assert( things.some(thing => thing.type === 'tag' && thing.name === 'brillout-tag') );
        })
    );

    promise.it("view doesn't return unecessary things", () =>
        Promise.all(
            ['tag-test-1', 'tag-test-2', 'tag-test-3', ]
            .map(name =>
                new Thing({
                    type: 'tag',
                    draft: {
                        name,
                        definition: 'a definition',
                        author: user.id,
                    },
                }).draft.save()
            )
        )
        .then( () =>
            Thing.database.load.view([{
                id: resource.id,
            }])
        )
        .then(things => {
            const tags = things.filter(t => t.type === 'tag');

            assert(tags.length>0);

            tags.forEach(tag => {
                assert( things.some(t =>
                        t.type === 'tagged' &&
                        t.referred_resource === resource.id &&
                        t.referred_tag === tag.id) );
            });
        })
    );

    promise.it("can save changes with only the thing ID and the changes", () =>
        (
            Thing.database.load.things({
                id: tag.id,
            })
        )
        .then(response => {
            assert( response.length === 1);
            const tag_copy_1 = response[0];
            assert(tag_copy_1.id === tag.id);
            assert(tag_copy_1.name === 'brillout-tag');
            assert(tag_copy_1.definition === 'definition of brillout-tag');

            const tag_copy_2 = new Thing({
                id: tag.id,
                draft: {
                    definition: 'new definition of brillout-tag',
                    author: user.id,
                },
            });

            return tag_copy_2.draft.save();
        })
        .then(tag_copy_3 => {
            tag_copy_3 = tag_copy_3[0];
            assert( tag_copy_3.id === tag.id );
            assert( tag_copy_3.definition === 'new definition of brillout-tag' );
            // ThingDB retrieves rest of thing's prop from database;
            assert( tag_copy_3.name === 'brillout-tag' );
            // if they are seveal authors, then author is the first author
            assert( tag_copy_3.author === user.id );
        })
    );

    promise.it("can pre-compute preview of resources, as per schema", () =>
        Thing.database.load.things({
            id: resource.id,
        })
        .then( things => {
            assert(things.length === 1);
            assert(things[0].preview);
            assert((things[0].preview.tags||1).constructor === Array);
            assert(things[0].preview.tags.length === 1);
            assert(things[0].preview.tags.includes('brillout-tag'));
        })
    );

    let tag2;
    promise.it("automatically updates preview of resource", () =>
        (tag2 = new Thing({
            type: 'tag',
            draft: {
                name: 'brillout-tag-2',
                definition: 'second test tag',
                author: user.id,
            },
        }))
        .draft.save()
        .then(new_tag =>
            new Thing({
                type: 'tagged',
                draft: {
                    referred_tag: new_tag[0].id,
                    referred_resource: resource.id,
                    author: user.id,
                }
            }).draft.save()
        )
        .then(() =>
            Thing.database.load.things({
                type: 'resource',
                github_full_name: resource.github_full_name,
            })
        )
        .then(things => {
            assert(things.length === 1);
            assert(things[0].preview.tags.length === 2);
            assert(things[0].preview.tags.includes('brillout-tag-2'));
        })
    );

    promise.it("also updates preview when removing stuff", () =>
        new Thing({
            type: 'tagged',
            referred_tag: tag2.id,
            referred_resource: resource.id,
            draft: {
                removed: true,
                author: user.id,
            },
        }).draft.save()
        .then(() =>
            Thing.database.load.things({
                id: resource.id,
            })
        )
        .then(things => {
            assert(things.length === 1);
            assert(things[0].github_full_name === resource.github_full_name);
            assert(things[0].preview.tags.length === 1);
            assert(things[0].preview.tags.includes('brillout-tag-2') === false);
        })
    );

    promise.it("makes github api requests before saving a resource, as per schema", () =>
        Thing.database.load.things({
            id: resource.id,
        })
        .then( things => {
            assert(things.length === 1);
            const github_info = things[0].github_info;
            assert(github_info);
            if( github_info._could_not_connect ) return;
            assert(github_info.github_full_name === 'FasterWeb');
            assert(github_info['readme']);
            assert(github_info['readme'].constructor === String);
            assert(github_info['readme'].includes('reduce the average time necessary for loading common JavaScript code'));
        })
    );

    promise.it("can recompute things from events", () => {
        const value = new Date(new Date()-1);
        return (
            Thing.database.load.things({
                computed_at: {
                    operator: '<=',
                    value,
                },
            })
            .then(things => {
                assert(things.length>0);
            })
        )
        .then(() =>
            Thing.recompute_all({
                computed_at: {
                    operator: '<=',
                    value,
                },
            })
        )
        .then( () =>
            Thing.database.load.things({
                computed_at: {
                    operator: '<=',
                    value,
                },
            })
            .then(things => {
                assert(things.length===0);
            })
        );
    });

});
