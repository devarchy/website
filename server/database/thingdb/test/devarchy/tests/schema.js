"use strict";
require('mocha');
const assert = require('assert');
const Thing = require('../thing')
require('../setup')(Thing);
const promise = require('../../test-promise')(Thing);
const population = require('../population');

describe("Devarchy's Schema", () => {

    before(population.create);

    promise.it("supports tagging resource with a tag", () => ( 
        Promise.all([
            new Thing({
                type: 'tag',
                name: 'npm_test-tag',
                npm_tags: ['fake-tag'],
                author: population.user.id,
            }).draft.save().then(([t]) => t),
            new Thing({
                type: 'resource',
                github_full_name: 'brillout/assertion-soft',
                npm_package_name: 'assertion-soft',
                author: population.user.id,
            }).draft.save().then(([t]) => t),
        ])
        .then(([tag, resource]) =>
            new Thing({
                type: 'tagged',
                referred_tag: tag.id,
                referred_resource: resource.id,
                author: population.user.id,
            }).draft.save()
        )
    )); 

    promise.it("supports adding a markdown list of libraries", () => { 

        let http_max_delay__org = Thing.http_max_delay;
        Thing.http_max_delay = 60*1000;

        return (
            new Thing({
                type: 'tag',
                author: population.user.id,
                markdown_list__github_full_name: 'brillout/awesome-redux',
                name: 'redux',
            }).draft.save()
        )
        .then(([tag]) => {
            Thing.http_max_delay = http_max_delay__org;
        })
        .catch(err => {
            if( err.response_connection_error ) {
                console.warn("Warning: Aborting test: connection problems");
                return;
            }
            throw err;
        })

    }, { timeout: 30*60*1000 }); 

    promise.it("supports adding a list of lists", () => { 

        let http_max_delay__org = Thing.http_max_delay;
        Thing.http_max_delay = 60*1000;

        return (
            new Thing({
                type: 'tag',
                draft: {
                    author: population.user.id,
                    markdown_list__github_full_name: 'devarchy/frontend-catalogs',
                    name: 'frontend-catalogs',
                },
            }).draft.save()
        )
        .then(([tag]) => {
            assert(tag.name==='frontend-catalogs');
            return Thing.database.load.view([{type: 'tag', name: tag.name}]);
        })
        .then(things => {
            assert(things.filter(t=>t.type==='resource').length>=2);
            assert(things.filter(t=>t.type==='resource' && t.referred_tag && t.preview_tag).length>=2);
            assert(things.filter(t=>t.type==='tag' && t.markdown_list__github_full_name).length>=1);
            assert(things.filter(t=>t.type==='tag' && t.referred_tag_markdown_list).length>=1);
            assert(things.filter(t=>t.type==='tag').length>=2);
            assert(things.filter(t=>t.type==='user').length>=2);
            return (
                Thing.database.load.things({
                    type: 'tag',
                })
                .then(tags => {
                    const debug_info = JSON.stringify(tags.filter(t => !t.referred_tag_markdown_list), null, 2);
                    assert(tags.find(t => t.name === 'frontend-catalogs'), debug_info);
                    ['redux', 'react', 'angular', 'frontend', 'vue', ].forEach(tag_name => {
                        const tag = tags.find(({name}) => name === tag_name);
                        assert(tag, tag_name, debug_info);
                        assert(things.find(({referred_tag}) => referred_tag===tag.id));
                    });
                })
            );
        })
        .then(() => {
            Thing.http_max_delay = http_max_delay__org;
        })
        .catch(err => {
            if( err.response_connection_error ) {
                console.warn("Warning: Aborting test: connection problems");
                return;
            }
            throw err;
        })

    }, { timeout: 30*60*1000 }); 

    /* TODO
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
                is_removed: true,
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

    */
});
