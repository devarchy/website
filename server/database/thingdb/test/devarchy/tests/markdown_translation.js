"use strict";
require('mocha');
const assert = require('assertion-soft/hard');
const expect = require('chai').expect;
const assert_chai = require('chai').assert;
const Promise = require('bluebird'); Promise.longStackTraces();
const Thing = require('../thing');
require('../setup')(Thing);
const promise = require('../../test-promise')(Thing);
const population = require('../population');
const ml = require('../../../../../util/multiline_tag.js');

describe('Devarchy Backend - Markdown translation', () => {

    let author;
    before(() => population.create().then(() => {author=population.user.id}));

    let resource__non_approved;
    promise.it("can translate a basic markdown text into a tag, categories and entries", () => { 
     // Thing.http_max_delay = null;
        const name = 'test-list-'+Math.random().toString().slice(2);
        return (
            new Thing({
                type: 'tag',
                name,
                author,
                markdown_text: md_intro+ml`
                    ## Super Category

                    **Super Category's description**

                    - [clean-sentence](https://github.com/brillout/clean-sentence) - An entry desc1.
                    - [auto-cli](https://github.com/brillout/node-auto-cli) - An entry desc2.
                `,
            }).draft.save()
            .then(things =>
                Thing.database.load.all_things()
                .then(things => {
                    const tag = things.find(t => t.name===name);
                    assert(tag);

                    const category = things.find(t => t.referred_tag_markdown_list===tag.id);
                    assert(category);
                    assert(category.name===name+':super-category', JSON.stringify(category, null, 2));

                    const resources = (
                        ['clean-sentence', 'auto-cli']
                        .map(pname => {
                            const res = things.find(t => t.type==='resource' && t.npm_package_name === pname);
                            assert(res);
                            return res;
                        })
                    );
                    resource__non_approved = resources[0];
                    resources.forEach(res => {
                        things.find(t => t.type==='tagged' && t.referred_resource===res.id && t.referred_tag===category.id);
                        [tag.name, category.name]
                        .forEach(tname => {
                            assert(res.preview.tags.includes(tname));
                        });
                    });

                    return (
                        Thing.database.load.view([{
                            type: 'tag',
                            name,
                        }])
                        .then(view => {
                            [tag, category, ...resources]
                            .forEach(({id}) => {
                                assert(view.find(t => t.id===id));
                            });

                            const taggeds = view.filter(t => t.type==='tagged');
                            taggeds.forEach(tagged => {
                                assert(tagged.referred_tag!==tag.id);
                                const ref_res = things.find(({id}) => id===tagged.referred_resource);
                                assert(ref_res);
                                assert(ref_res.type==='resource');
                                assert(resources.find(r => r.id===ref_res.id));
                                assert(tagged.referred_tag===category.id);
                            });

                        })
                    );
                })
            )
        );
    }); 

    promise.it("can parse category description", () => { 
     // Thing.http_max_delay = null;
        const name = 'test-list-'+Math.random().toString().slice(2);
        const cat_description = 'Description with `quote` and `<html>` quote';
        return (
            new Thing({
                type: 'tag',
                name,
                author,
                markdown_text: md_intro+ml`
                    # A Category

                    <em>
                    ${cat_description}
                    </em>

                    - [website-dependency-tree](https://github.com/brillout/website-dependency-tree)
                `,
            }).draft.save()
            .then(() =>
                Thing.database.load.things({
                    preview:{ tags: [name]},
                })
            )
            .then(things => {
                const tag = things.find(t => t.name===name);
                assert(tag);
                const category = things.find(t => t.referred_tag_markdown_list===tag.id);
                assert(category, things);
                assert(category.name===name+':a-category', JSON.stringify(category, null, 2));
                assert(category.category_description, category);
                assert(category.category_description===cat_description, cat_description, category.category_description);
            })
        );
    }); 

    let tag_catalog;
    let tag_category;
    promise.it("can translate a category hierachy", () => { 
        const name = 'test-md-list';
        return (
            new Thing({
                type: 'tag',
                name,
                author,
                markdown_text: md_intro+ml`
                    ## Top Cat

                    ### Sub Cat1

                    - [timerlog](https://github.com/brillout/timerlog) - Whatever1.

                    ### Sub Cat2

                    - [gulp-jspm](https://github.com/brillout/gulp-jspm) Whatever2
                `,
            }).draft.save()
            .then(() =>
                Thing.database.load.view([{
                    type: 'tag',
                    name,
                }])
            )
            .then(things => {
                const resources = (
                    ['timerlog', 'gulp-jspm']
                    .map(pname => {
                        const res = things.find(t => t.type==='resource' && t.npm_package_name === pname);
                        assert(res);
                        return res;
                    })
                );

                tag_catalog = things.find(t => t.name===name);
                assert(tag_catalog);
                assert(tag_catalog.name);
                assert(tag_catalog.preview.tags.includes(tag_catalog.name));
                assert(tag_catalog.preview.tags.length===1);

                const categories = (
                    things.filter(t => !!t.referred_tag_markdown_list)
                );
                assert(categories.length===3);

                const resource_timerlog = resources[0];
                const resource_gulpjspm = resources[1];
                const tag_cat_top = categories.filter(t => t.title==='Top Cat')[0];
                const tag_cat_sub1 = categories.filter(t => t.title==='Sub Cat1')[0];
                tag_category = tag_cat_sub1;
                const tag_cat_sub2 = categories.filter(t => t.title==='Sub Cat2')[0];
                assert(tag_cat_top && tag_cat_sub1 && tag_cat_sub2);

                is_only_tagged_with(resource_timerlog, tag_cat_sub1, things);
                is_only_tagged_with(resource_gulpjspm, tag_cat_sub2, things);
                number_of_tagged_resources(tag_cat_sub1, 1, things);
                number_of_tagged_resources(tag_cat_sub2, 1, things);
                number_of_tagged_resources(tag_cat_top, 0, things);

                assert(tag_cat_sub1.parent_category, tag_cat_sub1);
                assert(tag_cat_sub1.parent_category===tag_cat_top.id);
                assert(tag_cat_sub2.parent_category);
                assert(tag_cat_sub2.parent_category===tag_cat_top.id);
                assert(!tag_cat_top.parent_category);
            })
        );

        function is_only_tagged_with(resource, tag, things) {
            const taggeds = things.filter(t => t.type==='tagged' && t.referred_resource===resource.id);
            assert(taggeds.length===1);
            assert(taggeds[0].referred_tag===tag.id);
        }

        function number_of_tagged_resources(tag, number, things) {
            const taggeds = things.filter(t => t.type==='tagged' && t.referred_tag===tag.id);
            assert(taggeds.length===number);
        }
    }); 

    promise.it("can handle enty requests", () => ( 
        (
            new Thing({
                type: 'tagged',
                is_removed: false,
                referred_resource: resource__non_approved.id,
                referred_tag: tag_category.id,
                request_date: new Date(),
                author,
            }).draft.save()
        ).then(() =>
            events_retriever({
                test_promise: () => (
                    new Thing({
                        type: 'tag',
                        name: tag_catalog.name,
                        author,
                        markdown_text: md_intro+ml`
                            ## Top Cat

                            ### Sub Cat1

                            - [timerlog](https://github.com/brillout/timerlog) - Whatever1.

                            ### Sub Cat2

                            - [gulp-jspm](https://github.com/brillout/gulp-jspm) Whatever2
                        `,
                    }).draft.save()
                ),
                assert_promise: ({events, event_count}) => {
                    assert(events.length===event_count);
                },
            })
        )
    )); 

    promise.it("understands adding of an entry", () => { 
        assert(tag_catalog.name);
        return (
            new Thing({
                type: 'tag',
                name: tag_catalog.name,
                author,
                markdown_text: md_intro+ml`
                    ## Top Cat

                    ### Sub Cat1

                    - [timerlog](https://github.com/brillout/timerlog) - Whatever1.

                    ### Sub Cat2

                    - [gulp-jspm](https://github.com/brillout/gulp-jspm) Whatever2
                    - [assertion-soft](https://github.com/brillout/assertion-soft)
                `,
            }).draft.save()
            .then(() =>
                Thing.database.load.things({
                    preview:{ tags: [tag_catalog.name]},
                })
            )
            .then(things => {
                const resources = things.filter(t => t.type==='resource');
                const tags = things.filter(t => t.type==='tag');

                [
                    {
                        npm_package_name: 'timerlog',
                        github_full_name: 'brillout/timerlog',
                        category: 'Sub Cat1',
                        list: tag_catalog.name,
                    },
                    {
                        npm_package_name: 'gulp-jspm',
                        github_full_name: 'brillout/gulp-jspm',
                        category: 'Sub Cat2',
                        list: tag_catalog.name,
                    },
                    {
                        npm_package_name: 'assertion-soft',
                        github_full_name: 'brillout/assertion-soft',
                        category: 'Sub Cat2',
                        list: tag_catalog.name,
                    },
                ]
                .forEach(({github_full_name, npm_package_name, category, list}) => {
                    const resource = resources.find(t => t.github_full_name===github_full_name && t.npm_package_name===npm_package_name);
                    assert(resource);
                    assert(resource.preview.tags.includes(list));
                    assert(resource.preview.tags.includes(list))

                    const tag_cat = tags.find(t => t.title===category);
                    assert(tag_cat);
                    assert(resource.preview.tags.includes(tag_cat.name))

                    assert(resource.preview.tags.length===2);
                });

                assert(tags.find(t => t.name===tag_catalog.name));

                assert(things.length===resources.length+tags.length);
                assert(resources.length===4);
                assert(tags.length===4);
            })
        );
    }); 

    promise.it("understands change in categorisation - description change", () => { 
        assert(tag_catalog.name);

        const cat_desc = 'Desc for sub cat1';

        let events_count;

        return (
            (
                Thing.db_handle('thing_event')
                .then(events => {
                    events_count = events.length;
                })
            ).then(() =>
                new Thing({
                    type: 'tag',
                    name: tag_catalog.name,
                    author,
                    markdown_text: md_intro+ml`
                        ## Top Cat

                        ### Sub Cat1

                        *${cat_desc}*

                        - [timerlog](https://github.com/brillout/timerlog) - Whatever1.

                        ### Sub Cat2

                        - [gulp-jspm](https://github.com/brillout/gulp-jspm) Whatever2
                        - [assertion-soft](https://github.com/brillout/assertion-soft)
                    `,
                }).draft.save()
            )
            .then(() =>
                Thing.db_handle('thing_event').orderBy('created_at', 'desc')
                .then(events => {
                    assert_chai.equal(events.length, events_count+2);

                    const ev_1 = events[0];
                    assert_chai.equal(ev_1.json_data.category_description, cat_desc);
                    assert_chai.deepEqual(Object.keys(ev_1.json_data), ['category_description']);

                    const ev_2 = events[1];
                    assert_chai.deepEqual(Object.keys(ev_2.json_data), ['markdown_text']);
                })
            ).then(() =>
                new Thing({
                    type: 'tag',
                    name: tag_catalog.name,
                    author,
                    markdown_text: md_intro+ml`
                        ## Top Cat

                        ### Sub Cat1

                        - [timerlog](https://github.com/brillout/timerlog) - Whatever1.

                        ### Sub Cat2

                        - [gulp-jspm](https://github.com/brillout/gulp-jspm) Whatever2
                        - [assertion-soft](https://github.com/brillout/assertion-soft)
                    `,
                }).draft.save()
            )
            .then(() =>
                Thing.db_handle('thing_event').orderBy('created_at', 'desc')
                .then(events => {
                    assert_chai.equal(events.length, events_count+4);

                    const ev_1 = events[0];
                    assert_chai.equal(ev_1.json_data.category_description, null);
                    assert_chai.deepEqual(Object.keys(ev_1.json_data), ['category_description']);

                    const ev_2 = events[1];
                    assert_chai.deepEqual(Object.keys(ev_2.json_data), ['markdown_text']);
                })
            )
        );
    }); 

    promise.it("understands change in categorisation - new parent category", () => { 
        assert(tag_catalog.name);

        let events_count;

        return (
            (
                Thing.db_handle('thing_event')
                .then(events => {
                    events_count = events.length;
                })
            ).then(() =>
                new Thing({
                    type: 'tag',
                    name: tag_catalog.name,
                    author,
                    markdown_text: md_intro+ml`
                        ## Top Cat

                        ### Father Cat

                        ###### Sub Cat1

                        - [timerlog](https://github.com/brillout/timerlog) - Whatever1.

                        ###### Sub Cat2

                        - [gulp-jspm](https://github.com/brillout/gulp-jspm) Whatever2
                        - [assertion-soft](https://github.com/brillout/assertion-soft)
                    `,
                }).draft.save()
            )
            .then(() =>
                Thing.db_handle('thing_event').orderBy('created_at', 'desc')
                .then(events => {

                    assert_chai.equal(events.length, events_count+4);

                    const ev_4 = events[3];
                    assert_chai.deepEqual(Object.keys(ev_4.json_data), ['markdown_text']);

                    const ev_3 = events[2];
                    assert_chai.equal(ev_3.json_data.name, tag_catalog.name+':father-cat');
                    assert_chai.equal(ev_3.json_data.title, 'Father Cat');
                    assert_chai.equal(ev_3.json_data.is_removed, false);
                    assert_chai.equal(ev_3.json_data.referred_tag_markdown_list, tag_catalog.id);
                    assert(ev_3.json_data.parent_category);

                    const ev_1 = events[0];
                    assert_chai.equal(ev_1.json_data.parent_category, ev_3.id_thing);
                    assert([2, 3].includes(ev_1.json_data.category_order));

                    const ev_2 = events[1];
                    assert_chai.equal(ev_2.json_data.parent_category, ev_3.id_thing);
                    assert([2, 3].includes(ev_2.json_data.category_order));

                })
            )
        );
    }); 

    promise.it("understands change in categorisation - category name change", () => { 
        assert(tag_catalog.name);

        return (
            events_retriever({
                test_promise: () => (
                    new Thing({
                        type: 'tag',
                        name: tag_catalog.name,
                        author,
                        markdown_text: md_intro+ml`
                            ## Top Cat

                            ### Father Cat

                            ###### New Sub Cat1

                            - [timerlog](https://github.com/brillout/timerlog) - Whatever1.

                            ###### Sub Cat2

                            - [gulp-jspm](https://github.com/brillout/gulp-jspm) Whatever2
                            - [assertion-soft](https://github.com/brillout/assertion-soft)
                        `,
                    }).draft.save()
                ),
                assert_promise: ({events, event_count}) => {
                    assert_chai.equal(events.length, event_count+2);

                    const ev_1 = events[0];
                    assert_chai.equal(ev_1.json_data.name, tag_catalog.name+':new-sub-cat1');
                    assert_chai.equal(ev_1.json_data.title, 'New Sub Cat1');
                    assert_chai.deepEqual(Object.keys(ev_1.json_data), ['name', 'title']);

                    const ev_2 = events[1];
                    assert_chai.deepEqual(Object.keys(ev_2.json_data), ['markdown_text']);
                },
            })
            .then(() =>
                Thing.database.load.things({
                    preview: {tags: [tag_catalog.name+':new-sub-cat1']}
                })
                .then(things => {
                    assert(things.length>=1);
                    assert(things.find(({github_full_name: gh}) => gh==='brillout/timerlog'));
                    assert(things.find(({github_full_name: gh}) => gh==='brillout/clean-sentence'));
                    assert(things.length===2);
                })
            )
        );
    }); 

    promise.it("understands change in categorisation - single resource move", () => { 
        assert(tag_catalog.name);

        let events_count;

        return (
            (
                Thing.db_handle('thing_event')
                .then(events => {
                    events_count = events.length;
                })
            ).then(() =>
                new Thing({
                    type: 'tag',
                    name: tag_catalog.name,
                    author,
                    markdown_text: md_intro+ml`
                        ## Top Cat

                        ### Father Cat

                        ###### New Sub Cat1

                        - [timerlog](https://github.com/brillout/timerlog) - Whatever1.
                        - [assertion-soft](https://github.com/brillout/assertion-soft)

                        ###### Sub Cat2

                        - [gulp-jspm](https://github.com/brillout/gulp-jspm) Whatever2
                    `,
                }).draft.save()
            )
            .then(() =>
                Thing.db_handle('thing_event').orderBy('created_at', 'desc')
                .then(events => {

                    assert_chai.equal(events.length, events_count+2);

                    const ev_2 = events[1];
                    assert_chai.deepEqual(Object.keys(ev_2.json_data), ['markdown_text']);

                    const ev_1 = events[0];
                    assert_chai.deepEqual(Object.keys(ev_1.json_data), ['referred_tag']);

                })
            )
            .then(() =>
                Thing.database.load.things({
                    preview: {tags: [tag_catalog.name+':new-sub-cat1']}
                })
                .then(things => {
                    assert(things.find(t => t.github_full_name==='brillout/timerlog'));
                    assert(things.find(t => t.github_full_name==='brillout/assertion-soft'));
                    assert(things.find(t => t.github_full_name==='brillout/clean-sentence'));
                    assert(things.length===3, things);
                })
            )
            .then(() =>
                Thing.database.load.things({
                    preview: {tags: [tag_catalog.name+':sub-cat2']}
                })
                .then(things => {
                    assert(things.find(t => t.github_full_name==='brillout/gulp-jspm'));
                    assert(!things.find(t => t.github_full_name==='brillout/assertion-soft'));
                    assert(things.length===1, things);
                })
            )
        );
    }); 

    promise.it("understands change in categorisation - resource in two categories", () => { 
        // this test target the interal edge case when the upsert `{type: 'tagged', referred_resource, referred_tag: referred_tag__old, draft: {referred_tag: referred_tag__new}}` because of conflicting already existing `{type; 'tagged', referred_resource, referred_tag: referred_tag__new}`

        assert(tag_catalog.name);

        return (
            events_retriever({
                test_promise: () => (
                    new Thing({
                        type: 'tag',
                        name: tag_catalog.name,
                        author,
                        markdown_text: md_intro+ml`
                            ## Top Cat

                            ### Father Cat

                            ###### New Sub Cat1

                            - [timerlog](https://github.com/brillout/timerlog) - Whatever1.
                            - [assertion-soft](https://github.com/brillout/assertion-soft)

                            ###### Sub Cat2

                            - [gulp-jspm](https://github.com/brillout/gulp-jspm) Whatever2
                            - [assertion-soft](https://github.com/brillout/assertion-soft)
                        `,
                    }).draft.save()
                ),
                assert_promise: ({events, event_count}) => {

                    assert_chai.equal(events.length, event_count+2);

                    const ev_2 = events[1];
                    assert_chai.deepEqual(Object.keys(ev_2.json_data), ['markdown_text']);

                    const first_ev_is_removal = events[0].is_removed!==undefined;

                    const ev_1 = events[0];
                    assert_chai.equal(ev_1.json_data.is_removed, false);
                    assert_chai.equal(ev_1.json_data.request_approved, true);
                    assert_chai.deepEqual(
                        Object.keys(ev_1.json_data).sort(),
                        ['is_removed', 'referred_tag', 'request_approved', 'referred_resource'].sort()
                    );

                },
            })
            .then(() =>
                Thing.database.load.things({
                    preview: {tags: [tag_catalog.name+':new-sub-cat1']}
                })
                .then(things => {
                    assert(things.find(t => t.github_full_name==='brillout/timerlog'));
                    assert(things.find(t => t.github_full_name==='brillout/assertion-soft'));
                    assert(things.find(t => t.github_full_name==='brillout/clean-sentence'));
                    assert(things.length===3, things);
                })
            )
            .then(() =>
                Thing.database.load.things({
                    preview: {tags: [tag_catalog.name+':sub-cat2']}
                })
                .then(things => {
                    assert(things.find(t => t.github_full_name==='brillout/gulp-jspm'));
                    assert(things.find(t => t.github_full_name==='brillout/assertion-soft'));
                    assert(things.length===2, things);
                })
            )
        );
    }); 

    promise.it("understands change in categorisation - resource moved back", () => { 
        // this test target the interal edge case when the upsert `{type: 'tagged', referred_resource, referred_tag: referred_tag__old, draft: {referred_tag: referred_tag__new}}` because of conflicting already existing `{type; 'tagged', referred_resource, referred_tag: referred_tag__new}`

        assert(tag_catalog.name);

        return (
            (
                new Thing({
                    type: 'tag',
                    name: tag_catalog.name,
                    author,
                    markdown_text: md_intro+ml`
                        ## Top Cat

                        ### Father Cat

                        ###### New Sub Cat1

                        - [timerlog](https://github.com/brillout/timerlog) - Whatever1.
                        - [assertion-soft](https://github.com/brillout/assertion-soft)

                        ###### Sub Cat2

                        - [gulp-jspm](https://github.com/brillout/gulp-jspm) Whatever2
                    `,
                }).draft.save()
            )
            .then(() =>
                events_retriever({
                    test_promise: () => (
                        new Thing({
                            type: 'tag',
                            name: tag_catalog.name,
                            author,
                            markdown_text: md_intro+ml`
                                ## Top Cat

                                ### Father Cat

                                ###### New Sub Cat1

                                - [timerlog](https://github.com/brillout/timerlog) - Whatever1.

                                ###### Sub Cat2

                                - [gulp-jspm](https://github.com/brillout/gulp-jspm) Whatever2
                                - [assertion-soft](https://github.com/brillout/assertion-soft)
                            `,
                        }).draft.save()
                    ),
                    assert_promise: ({events, event_count}) => {

                        assert_chai.equal(events.length, event_count+3);

                        const ev_3 = events[2];
                        assert_chai.deepEqual(Object.keys(ev_3.json_data), ['markdown_text']);

                        const first_ev_is_removal = events[0].json_data.is_removed===true;

                        const ev_1 = events[1-first_ev_is_removal];
                        assert_chai.equal(ev_1.json_data.is_removed, true);
                        assert_chai.deepEqual(Object.keys(ev_1.json_data), ['is_removed']);

                        const ev_2 = events[0+first_ev_is_removal];
                        assert_chai.equal(ev_2.json_data.is_removed, false);
                        assert_chai.deepEqual(Object.keys(ev_2.json_data).sort(), ['is_removed'].sort());

                    },
                })
            )
            .then(() =>
                Thing.database.load.things({
                    preview: {tags: [tag_catalog.name+':new-sub-cat1']}
                })
                .then(things => {
                    assert(things.find(t => t.github_full_name==='brillout/timerlog'));
                    assert(things.find(t => t.github_full_name==='brillout/clean-sentence'));
                    assert(things.length===2, things);
                })
            )
            .then(() =>
                Thing.database.load.things({
                    preview: {tags: [tag_catalog.name+':sub-cat2']}
                })
                .then(things => {
                    assert(things.find(t => t.github_full_name==='brillout/gulp-jspm'));
                    assert(things.find(t => t.github_full_name==='brillout/assertion-soft'));
                    assert(things.length===2, things);
                })
            )
        );
    }); 

    promise.it("understands change in categorisation - resource removal", () => ( 
        events_retriever({
            test_promise: () => (
                new Thing({
                    type: 'tag',
                    name: tag_catalog.name,
                    author,
                    markdown_text: md_intro+ml`
                        ## Top Cat

                        ### Father Cat

                        ###### New Sub Cat1

                        - [timerlog](https://github.com/brillout/timerlog) - Whatever1.

                        ###### Sub Cat2

                        - [gulp-jspm](https://github.com/brillout/gulp-jspm) Whatever2
                    `,
                }).draft.save()
            ),
            assert_promise: ({events, event_count}) => {

                assert_chai.equal(events.length, event_count+2);

                const ev_1 = events[0];
                assert_chai.equal(ev_1.json_data.request_approved, false);
                assert_chai.deepEqual(Object.keys(ev_1.json_data), ['request_approved']);

                const ev_2 = events[1];
                assert_chai.deepEqual(Object.keys(ev_2.json_data), ['markdown_text']);

                const cat_name = tag_catalog.name+':sub-cat2';
                return (
                    Thing.database.load.things({
                        preview: {tags: [cat_name]}
                    })
                    .then(things => {
                        assert(things.find(t => t.github_full_name==='brillout/gulp-jspm'));
                        assert(things.find(t => t.github_full_name==='brillout/assertion-soft' && t.preview.tagreqs.some(tr => tr.req_tag_name===cat_name && tr.req_approved===false)), things);
                        assert(things.length===2, things);
                    })
                );
            },
        })
    )); 

    promise.it("understands change in categorisation - merge categories", () => ( 
        events_retriever({
            test_promise: () => (
                new Thing({
                    type: 'tag',
                    name: tag_catalog.name,
                    author,
                    markdown_text: md_intro+ml`
                        ## Top Cat

                        ### Father Cat

                        ###### Sub Cat2

                        - [timerlog](https://github.com/brillout/timerlog) - Whatever1.
                        - [gulp-jspm](https://github.com/brillout/gulp-jspm) Whatever2
                    `,
                }).draft.save()
            ),
            assert_promise: ({events, event_count}) => {

                assert_chai.equal(events.length, event_count+5);

                const ev_1 = events[0];
                assert(ev_1.type==='tagged');
                assert_chai.deepEqual(Object.keys(ev_1.json_data), ['referred_tag']);

                const ev_2 = events[1];
                assert(ev_2.type==='tagged');
                assert_chai.deepEqual(Object.keys(ev_2.json_data), ['referred_tag']);

                const ev_3 = events[2];
                assert(ev_3.type==='tag');
                assert_chai.deepEqual(Object.keys(ev_3.json_data), ['is_removed']);
                assert(ev_3.json_data.is_removed===true);

                const ev_4 = events[3];
                assert(ev_4.type==='tag');
                assert_chai.deepEqual(Object.keys(ev_4.json_data), ['category_order']);
                assert(ev_4.json_data.category_order===2);

                const ev_5 = events[4];
                assert_chai.deepEqual(Object.keys(ev_5.json_data), ['markdown_text']);

                const cat_name = tag_catalog.name+':sub-cat2';
                return (
                    Thing.database.load.things({
                        preview: {tags: [cat_name]}
                    })
                    .then(things => {
                        assert(things.find(t => t.github_full_name==='brillout/timerlog'));
                        assert(things.find(t => t.github_full_name==='brillout/gulp-jspm'), things);
                        assert(things.find(t => t.github_full_name==='brillout/clean-sentence'));
                        assert(things.find(t => t.github_full_name==='brillout/assertion-soft' && t.preview.tagreqs.some(tr => tr.req_tag_name===cat_name && tr.req_approved===false)), things);
                        assert(things.length===4, things);
                    })
                );
            },
        })
    )); 

    promise.it("understands change in categorisation - entry in several categories", () => ( 
        events_retriever({
            test_promise: () => (
                new Thing({
                    type: 'tag',
                    name: tag_catalog.name,
                    author,
                    markdown_text: md_intro+ml`
                        ## Top Cat

                        ### Father Cat

                        ###### Sub Cat2

                        - [timerlog](https://github.com/brillout/timerlog) - Whatever1.
                        - [gulp-jspm](https://github.com/brillout/gulp-jspm) Whatever2

                        ## Flat 1

                        - [mini-log](https://github.com/brillout/node-mini-log)

                        ## Flat 2
                        - [mini-log](https://github.com/brillout/node-mini-log)

                        ## Flat 3
                        - [mini-log](https://github.com/brillout/node-mini-log)
                    `,
                }).draft.save()
            ),
            assert_promise: ({events, event_count}) => {

                assert_chai.equal(events.length, event_count+8);

                events.slice(0, 3)
                .forEach((ev, i) => {
                    assert(ev.type==='tagged');
                    assert_chai.deepEqual(Object.keys(ev.json_data).sort(), ['is_removed', 'referred_tag', 'referred_resource', 'request_approved'].sort());
                    assert(ev.json_data.is_removed===false);
                    assert(ev.json_data.request_approved===true);
                });

                events.slice(3, 6)
                .forEach((ev, i) => {
                    assert(ev.type==='tag');
                    assert(['name', 'title'].every(prop => ev.json_data[prop]));
                });

                const ev_7 = events[6];
                assert(ev_7.type==='resource');
                assert(ev_7.json_data.github_full_name==='brillout/node-mini-log');

                const ev_8 = events[7];
                assert(ev_8.type==='tag');
                assert_chai.deepEqual(Object.keys(ev_8.json_data), ['markdown_text']);

                return (
                    Thing.database.load.things({
                        preview: {tags: [tag_catalog.name]}
                    })
                    .then(things => {
                        const auto_cli = things.find(t => t.github_full_name==='brillout/node-mini-log');
                        assert(auto_cli);
                        assert_chai.deepEqual(
                            [
                                tag_catalog.name,
                                ...['flat-1', 'flat-2', 'flat-3'].map(catname => tag_catalog.name+':'+catname)
                            ].sort(),
                            auto_cli.preview.tags.sort()
                        );
                    })
                );
            },
        })
    )); 

    promise.it("understands change in categorisation - preserve entry in several categories", () => ( 
        events_retriever({
            test_promise: () => (
                new Thing({
                    type: 'tag',
                    name: tag_catalog.name,
                    author,
                    markdown_text: md_intro+ml`
                        ## Top Cat

                        ### Father Cat

                        ###### Sub Cat2

                        - [timerlog](https://github.com/brillout/timerlog) - Whatever1.
                        - [gulp-jspm](https://github.com/brillout/gulp-jspm) Whatever2

                        ## Flat 1

                        - [mini-log](https://github.com/brillout/node-mini-log)

                        ## Flat 2
                        - [mini-log](https://github.com/brillout/node-mini-log)

                        ## Flat 3
                        - [mini-log](https://github.com/brillout/node-mini-log)
                    `,
                }).draft.save()
            ),
            assert_promise: ({events, event_count}) => {
                assert_chai.equal(events.length, event_count);
            },
        })
    )); 

    promise.it("understands change in categorisation - move entry to several categories", () => ( 
        events_retriever({
            test_promise: () => (
                new Thing({
                    type: 'tag',
                    name: tag_catalog.name,
                    author,
                    markdown_text: md_intro+ml`
                        ## Top Cat

                        ### Father Cat

                        ###### Sub Cat2

                        - [timerlog](https://github.com/brillout/timerlog) - Whatever1.

                        ## Flat 1

                        - [mini-log](https://github.com/brillout/node-mini-log)
                        - [gulp-jspm](https://github.com/brillout/gulp-jspm) Whatever2

                        ## Flat 2
                        - [gulp-jspm](https://github.com/brillout/gulp-jspm) Whatever2
                        - [mini-log](https://github.com/brillout/node-mini-log)

                        ## Flat 3
                        - [mini-log](https://github.com/brillout/node-mini-log)
                        - [gulp-jspm](https://github.com/brillout/gulp-jspm) Whatever2
                    `,
                }).draft.save()
            ),
            assert_promise: ({events, event_count}) => {

                assert_chai.equal(events.length, event_count+4);

                const ev_1 = events[0];
                assert(ev_1.type==='tagged');
                assert(ev_1.json_data.referred_tag);
                assert(ev_1.json_data.referred_resource===undefined);
                assert(events.filter(e => e.id_thing===ev_1.id_thing).length>1);

                [events[1], events[2]]
                .forEach(ev => {
                    assert(ev.type==='tagged');
                    assert(ev.json_data.referred_tag);
                    assert(ev.json_data.referred_resource);
                    assert(events.filter(e => e.id_thing===ev.id_thing).length===1);
                });

                const ev_4 = events[3];
                assert(ev_4.type==='tag');
                assert_chai.deepEqual(Object.keys(ev_4.json_data), ['markdown_text']);

                return (
                    Thing.database.load.things({
                        preview: {tags: [tag_catalog.name]}
                    })
                    .then(things => {
                        const gulp_jspm = things.find(t => t.github_full_name==='brillout/gulp-jspm');
                        assert(gulp_jspm);
                        assert_chai.deepEqual(
                            [
                                tag_catalog.name,
                                ...['flat-1', 'flat-2', 'flat-3',].map(catname => tag_catalog.name+':'+catname)
                            ].sort(),
                            gulp_jspm.preview.tags.sort()
                        );
                    })
                );
            },
        })
    )); 

    promise.it("understands change in categorisation - split category in two similar categories", () => ( 
        (
            new Thing({
                type: 'tag',
                name: 'flat-catalog',
                author,
                markdown_text: ml`
                    # Cat 1
                    - [timerlog](https://github.com/brillout/timerlog)
                    - [mini-log](https://github.com/brillout/node-mini-log)
                    - [gulp-jspm](https://github.com/brillout/gulp-jspm)
                `,
            }).draft.save()
        ).then(() =>
        events_retriever({
            test_promise: () => (
                new Thing({
                    type: 'tag',
                    name: 'flat-catalog',
                    author,
                    markdown_text: ml`
                        # Cat 2
                        - [timerlog](https://github.com/brillout/timerlog)
                        - [mini-log](https://github.com/brillout/node-mini-log)
                        - [gulp-jspm](https://github.com/brillout/gulp-jspm)

                        # Cat 3
                        - [timerlog](https://github.com/brillout/timerlog)
                        - [gulp-jspm](https://github.com/brillout/gulp-jspm)
                    `,
                }).draft.save()
            ),
            assert_promise: ({events, event_count}) => {

                return (
                    Thing.database.load.things({
                        preview: {tags: ['flat-catalog']}
                    })
                    .then(things => {
                        ['gulp-jspm', 'mini-log', 'timerlog']
                        .forEach(npm_package_name => {
                            assert_tagged({things, npm_package_name, tag_category_title: 'Cat 2'});
                            assert_tagged({things, npm_package_name, tag_category_title: 'Cat 1', not_tagged: true});
                        });
                        ['gulp-jspm', 'timerlog']
                        .forEach(npm_package_name => {
                            assert_tagged({things, npm_package_name, tag_category_title: 'Cat 3'});
                        });
                        assert_tagged({things, npm_package_name: 'mini-log', tag_category_title: 'Cat 3', not_tagged: true});
                    })
                );
            },
        })
        )
    )); 
});

const md_intro = ( 
    ml`
        # A prog libs catalog

        Some

        > bla

        [<img src="https://example.org/logo.svg" align="right" width="110">](bla)

        -

        #### Contents
        - [Sup](#hashi)

    `
); 

/* usage template
            events_retriever({
                test_promise: () => (
                ),
                assert_promise: ({events, event_count}) => {
                },
            })
*/
function events_retriever({test_promise, assert_promise}) { 
    let event_count;
    let events;

    return (
        Promise.resolve()
        .then(() =>
            Thing.db_handle('thing_event')
            .then(evs => {
                event_count = evs.length;
            })
        )
        .then(test_promise)
        .then(() =>
            Thing.db_handle('thing_event').orderBy('created_at', 'desc')
            .then(evs => {
                events = evs
                return {events, event_count};
            })
        )
        .then(assert_promise)
        .catch(err => {
            if( !events ) {
                throw err;
            }
            try {
                console.log(
                    JSON.stringify(events.slice(0, -event_count), null, 2)
                );
            } catch(e) {
                console.log(e);
            }
            throw err;
        })
    );
} 

function assert_tagged({things, npm_package_name, tag_category_title, not_tagged}) { 
    const resource = find(t => t.npm_package_name===npm_package_name);
    const tag_catalog = find(t => t.type==='tag' && !t.referred_tag_markdown_list);
    const tag_category = find(t => t.type==='tag' && t.referred_tag_markdown_list===tag_catalog.id && t.title===tag_category_title, not_tagged===true);

    if( tag_category===null && not_tagged===true ) {
        return true;
    }

    const cat_name = tag_category.name;

    if( ! resource.preview.tags.includes(cat_name) ) {
        const trS = resource.preview.tagreqs.filter(tr => tr.req_tag_name===cat_name);
        assert(trS.length===0, resource, tag_category_title);
    }

    const passed = (
        ! not_tagged ? (
            resource.preview.tags.includes(cat_name)
        ) : (
            ! resource.preview.tags.includes(cat_name)
        )
    );
    assert(
        passed,
        resource, tag_category, resource.preview, cat_name, resource.npm_package_name
    );

    function find(fct, can_be_null=false) {
        const found = things.filter(fct);
        if( can_be_null && found.length===0 ) {
            return null;
        }
        assert(found.length===1, things, found, npm_package_name, tag_category_title);
        return found[0];
    }
} 
