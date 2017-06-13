"use strict";
require('mocha');
const assert = require('assert');
const expect = require('chai').expect;
const assert_chai = require('chai').assert;
const Promise = require('bluebird'); Promise.longStackTraces();
const Thing = require('../thing');
require('../setup')(Thing);
const promise = require('../../test-promise')(Thing);
const population = require('../population');
const providers = require('../../../../../http/auth/providers');
const ml = require('../../../../../util/multiline_tag.js');


describe('ThingDB - Devarchy Frontend Use Cases', () => {

    let author;
    before(() => population.create().then(() => {author=population.user.id}));

    let tag;
    let tag_category;
    let tag_category2;
    let tag__old_resources;
    promise.it('supports meta lists & lists of github repos', () => { 
        const http_max_delay__org = Thing.http_max_delay;
        Thing.http_max_delay = null;

        const name_meta_list = 'prog-libs';
        const name_redux_list = 'redux';
        return (
            new Thing({
                author,
                type: 'tag',
                name: name_meta_list,
                markdown_text: ml`
                    # Progri Libraries

                     - [Redux Libraries](https://github.com/brillout/awesome-redux)
                `,
            }).draft.save()
            .then(() =>
                Thing.database.load.things({
                    type: 'resource',
                    preview: {tags: [name_meta_list]},
                })
                .then(things => {
                    assert(things.length>=1);
                    assert(things.length===1);
                    const resource = things[0];
                    assert(resource.referred_tag);
                    assert(resource.preview_tag.name===name_redux_list);
                    assert(resource.preview.tags.includes(name_meta_list));
                    assert(resource.preview.tags.length>=2);
                    assert(resource.preview.tags.includes(name_meta_list+':progri-libraries'));
                    assert(resource.preview.tags.length===2);
                    assert(resource.preview.tagreqs.length===0, JSON.stringify(resource, null, 2));
                })
            )
            .then(() =>
                Thing.database.load.things({
                    type: 'tag',
                    name: name_redux_list,
                })
                .then(things => {
                    assert( things.is_private() === false );
                    assert( things.length === 1 );
                    tag = things[0];
                    assert( tag.markdown_list__github_full_name==='brillout/awesome-redux');
                    assert( tag.history.length === 1);
                })
            )
            .then(() =>
                Thing.database.load.view([{
                    type: 'tag',
                    name: tag.name,
                }])
                .then(view => {
                    const tags = view.filter(t => t.type==='tag');
                    const resources = view.filter(t => t.type==='resource');
                    assert( tags.length > 20 );
                    assert( resources.length > 50 );
                    const categories = tags.filter(t => t.referred_tag_markdown_list === tag.id);
                    assert( categories.length > 0 );
                    assert( categories.length > 10 );
                    assert( categories.length > 15 );
                    tag_category = categories[0];
                    tag_category2 = categories[9];
                    assert(categories.every(({name}) => name.startsWith(tag.name+':')));
                    tag__old_resources = resources;
                })
            )
            .then(() =>
                Thing.database.load.view([{
                    type: 'tag',
                    name: name_meta_list,
                }])
                .then(things => {
                    assert(things.find(t => t.name===name_meta_list));
                    assert(things.find(t => t.name===tag.name));
                })
            )
            .then(() => {
                Thing.http_max_delay = http_max_delay__org;
            })
        );
    }, {timeout: 200*1000}); 

    let users = {};
    promise.it('can login users', () => { 

        const users_info = (
            providers
            .map(({provider_name, identifier: {name}}) => ({
                provider_name,
                username_key: name,
                username: 'fake_user_name_'+Math.random(),
            }))
        );

        assert(users_info.every(({provider_name}) => ['facebook', 'twitter', 'github'].includes(provider_name)) && users_info.length===3);

        return (
            login_users()
            .then(() => login_users())
        );

        function login_users() {
            return (
                Promise.all(
                    users_info.map(({provider_name, username_key, username}) => {
                        return (
                            new Thing({
                                type: 'user',
                                [username_key]: username,
                                draft: {},
                            })
                            .draft.save()
                            .then(([user_]) => {
                                assert(user_.type==='user');
                                assert(user_.id);
                                assert(user_[username_key]);
                                assert(user_[username_key]===username);
                                users[provider_name] = user_;
                                return (
                                    new Thing({
                                        type: 'user_private_data',
                                        referred_user: user_.id,
                                        author: user_.id,
                                        draft: {
                                            auth_token: {
                                                token: 'fake_token_'+Math.random(),
                                            },
                                        },
                                    }).draft.save()
                                );
                            })
                        );
                    })
                )
            );
        }
    }); 
    promise.it('can retrieve users', () => ( 
        Promise.all(
            providers
            .map(({provider_name, identifier: {name}}) => {
                const user = users[provider_name];
                return (
                    Thing.database.load.things({type: 'user', id: user.id})
                    .then(things => {
                        assert(things.length === 1);
                        assert(things.is_private() === false);
                        const user_ = things[0];
                        assert(user_.type==='user');
                        assert(user_.id===user.id);
                        assert(user_[name]===user[name]);
                        assert(user_.history.length === 1);
                        expect(user_[provider_name+'_info']).to.deep.equal(user[provider_name+'_info']);
                    })
                );
            })
        )
    )); 
    promise.it("marks sensitive user info as private", () => ( 
        Thing.database.load.things({
            type: 'user_private_data',
        })
        .then(things => {
            assert(things.length>1);
            assert(things.is_private() === true);
        })
    )); 

    promise.it_validates_if("GitHub repo doesn't exist when adding resource", () => { 
        const http_max_delay__org = Thing.http_max_delay;
        Thing.http_max_delay = null;

        return (
            new Thing({
                type: 'resource',
                github_full_name: 'brillout/i-dont-exist',
                npm_package_name: 'brillout-i-dont-exist',
                author,
            })
            .draft.save()
            .finally(() => {
                Thing.http_max_delay = http_max_delay__org;
            })
        );
    }, {reason: 'Could not retrieve repository information from GitHub'}); 

    const resources_info = [ 
        {
            github_full_name: 'brillout/timerlog',
            npm_package_name: 'timerlog',
        },
        {
            resource_url: 'http://brillout.com',
        },
    ]; 
    let resources__requested;
    promise.it('can add resources to a list', () => { 
        const resources_map = {};

        const http_max_delay__org = Thing.http_max_delay;
        Thing.http_max_delay = null;

        return (
            (
                add_resources()
            )
            .then(() =>
                add_resources()
            )
            .then(() => {
                resources__requested = Object.values(resources_map);
                assert(resources__requested.length===resources_info.length);
            })
            .then(() => {
                Thing.http_max_delay = http_max_delay__org;
            })
        );

        function add_resources() {
            return (
                Promise.all(
                    resources_info
                    .map(resource_info => (
                        add_resource_to_category(resource_info, tag_category)
                        .then(resource =>
                            resources_map[resource.id] = resource
                        )
                    ))
                )
            );
        }

    }, {timeout: 120*1000}); 

    promise.it("can load a list's resources", () => ( 
        (
            Thing.database.load.things({
                type: 'resource',
                preview: {tags: [tag.name]},
            })
        )
        .then(resources => {
            assert(resources.every(t => t.type==='resource'));
            check_for_resources(resources);
        })
    )); 

    promise.it("can load a list's categories", () => ( 
        (
            Thing.database.load.things({
                type: 'tag',
                preview: {tags: [tag.name]},
            })
        )
        .then(tags => {
            assert(tags.every(t => t.type==='tag'));
            check_for_tags(tags);
        })
    )); 

    let all_things_for_tag;
    promise.it("can load a list's resources and categories", () => ( 
        (
            Thing.database.load.things({
                preview: {tags: [tag.name]},
            })
        )
        .then(things => {
            assert(things.every(t => ['resource', 'tag'].includes(t.type)));
            check_for_tags(things);
            check_for_resources(things);
            all_things_for_tag=things;
        })
    )); 

    promise.it("can serialize cross-type things with given result_fields", () => ( 
        (
            Promise.resolve()
        )
        .then(() => {
            const str = (
                all_things_for_tag.serialize_me({
                    include_side_props: true,
                })
            );
            assert([tag_category, tag_category2].every(tc => str.includes(tc.name)));
            resources__requested.forEach(t => {
                assert(
                    [t.github_full_name, t.npm_package_name, t.resource_url]
                    .some(val => str.includes(val))
                );
            });
            assert(['created_at', 'id'].every(key => str.match(new RegExp('\b'+key+'\b', 'g').length===all_things_for_tag.length)));
        })
    )); 

    promise.it("can change a resource's npm_package_name and github_full_name", () => { 
        const resource = all_things_for_tag.find(t => t.type === 'resource' && t.preview.tagreqs.length===0);
        assert(resource);
        assert(resource.preview.tags.includes(tag.name));
        const tag_category = all_things_for_tag.find(t => t.type === 'tag' && t.referred_tag_markdown_list===tag.id && resource.preview.tags.includes(t.name));
        assert(tag_category);
        assert(all_things_for_tag.find(t => t.npm_package_name==='website-dependency-tree')===undefined);
        assert(all_things_for_tag.find(t => t.github_full_name==='brillout/website-dependency-tree')===undefined);
        const resource_info = {
            npm_package_name: 'website-dependency-tree',
            github_full_name: resource.github_full_name,
        };

        let events_count;

        return (
            (
                Thing.db_handle('thing_event')
                .then(events => {
                    events_count = events.length;
                })
            ).then(() =>
                add_resource_to_category(resource_info, tag_category)
            ).then(() =>
                Thing.db_handle('thing_event').orderBy('created_at', 'desc')
                .then(events => {
                    if( events.length !== ++events_count ) {
                        console.log(JSON.stringify(resource.preview, null, 2));
                        console.log(JSON.stringify(tag_category, null, 2));
                        console.log(JSON.stringify(events.slice(0, events.length - events_count + 1), null, 2));
                        assert_chai.equal(events.length, events_count);
                    }
                    const ev = events[0];
                    assert(ev.json_data.npm_package_name === 'website-dependency-tree');
                    assert_chai.deepEqual(Object.keys(ev.json_data), ['npm_package_name']);
                })
            )
        );
    }); 

    promise.it("can load a list's resources and categories -- via view", () => ( 
        (
            Thing.database.load.view([{
                type: 'tag',
                name: tag.name,
            }])
        )
        .then(things => {
            check_for_tags(things, {strict: false});
            check_for_resources(things);
            const resources = things.filter(t => t.type==='resource');
            const tagged = things.filter(t => t.type==='tagged');
            const categories = things.filter(t => t.type==='tag' && t.referred_tag_markdown_list);
            const tags_list = things.filter(t => t.type==='tag' && !t.referred_tag_markdown_list);
            assert(resources.length>50);
            assert(tagged.length>50);
            assert(categories.length>20);
            assert(tagged.length>=resources.length);
            assert(tags_list.length>=1);
            things.forEach(thing => assert(['resource', 'tag', 'tagged', 'user'].includes(thing.type), thing))
        })
    )); 

    promise.it("can view resource's related things", () => { 
        const resource_info = resources_info[0];
        return (
            (
                Thing.database.load.view([
                    Object.assign({type: 'resource'}, resource_info)
                ])
            )
            .then(things => {
                const resource =
                    things.find(t => t.type === 'resource' && ['github_full_name', 'npm_package_name', 'resource_url'].every(p => t[p] === resource_info[p]));
                assert( resource );
                assert( things.some(t => t.type === 'tagged' && t.referred_tag === tag_category.id && t.referred_resource === resource.id && t.request_date) );
                assert( things.some(t => t.type === 'tag' && t.name === tag.name) );
                assert_chai.equal(things.filter(({type}) => type==='resource').length, 1);
                assert(things.filter(({type}) => type==='tag').length >= 2);
             // assert_chai.equal(things.filter(({type}) => type==='tag').length, 2);
                assert(things.filter(({type}) => type==='tagged').length >= 1);
             // assert_chai.equal(things.filter(({type}) => type==='tagged').length, 1);
                assert(things.filter(({type}) => type==='user').length >= 1);
             // assert_chai.equal(things.filter(({type}) => type==='user').length, 1);
                assert(things.length >= 5);
             // assert_chai.equal(things.length, 5);
            })
        );
    }); 

    promise.it('can change the category of a resource request', () => { 
        const start_time = new Date();
        const tag_category1 = tag_category;
        const resource = resources__requested[0];

        // if one of these two fails -> problem with test setup
        assert(resource.preview.tags.includes(tag_category1.name)===true, resource, tag_category1, tag_category2);
        assert(resource.preview.tags.includes(tag_category2.name)===false, resource, tag_category1, tag_category2);

        return (
            add_resource_to_category(resource, tag_category2)
            .then(() =>
                Thing.database.load.things({
                    type: 'resource',
                    preview: {
                        tags: [tag.name],
                    },
                })
            )
            .then(resources_new => {
                assert(find_preview(resource.id, tag_category1, resources__requested));
                assert(find_preview(resource.id, tag_category2, resources__requested)===undefined);
                assert(find_preview(resource.id, tag_category1, resources_new)===undefined);
                const prv = find_preview(resource.id, tag_category2, resources_new);
                if( !prv ) {
                    console.log(JSON.stringify(tag_category1, null, 2));
                    console.log(JSON.stringify(tag_category2, null, 2));
                    assert(false);
                }
                assert(new Date(prv.req_date) < start_time, '!( '+new Date(prv.req_date).getTime()+' < '+start_time.getTime()+' )');
            })
        );

    }, {timeout: 120*1000}); 

    let resource;
    promise.it('can add a request for an already included resource', () => { 
        const start_time = new Date();

        resource = tag__old_resources.find(r => r.preview.tagreqs.length===0);
        const resource__tags = resource.preview.tags;
        assert(resource__tags.length>=2);
        assert(resource__tags.length===2);
        assert(!resource__tags.includes(tag_category.name));
        assert(!find_preview(resource.id, tag_category, tag__old_resources));

        return (
            add_resource_to_category(resource, tag_category)
            .then(() =>
                Thing.database.load.things({
                    type: 'resource',
                    preview: {
                        tags: [tag.name],
                    },
                })
            )
            .then(resources_updated => {
                const resource_updated = resources_updated.find(t => t.id===resource.id);
                const resource_updated__tags = resource_updated.preview.tags;

                assert(resource_updated__tags.includes(tag_category.name));
                assert(resource__tags.every(tagname => resource_updated__tags.includes(tagname)));
                assert(resource__tags.length + 1 === resource_updated__tags.length);

                assert(resource_updated.preview.tagreqs.length>=1);
                assert(resource_updated.preview.tagreqs.length===1);
                const prv = find_preview(resource.id, tag_category, resources_updated);
                assert(prv);
                assert(new Date(prv.req_date) > start_time, '!( '+new Date(prv.req_date).getTime()+' > '+start_time.getTime()+' )');
                resource = resource_updated;
            })
        );
    }); 

    promise.it('can add a request for an already approved resource', () => { 
        return (
            approve_category(resource, tag_category)
            .then(things => {
                const resource_updated = things.find(t => t.id===resource.id);
                assert(resource_updated);
                assert(resource_updated.preview.tags.includes(tag_category.name));
                const prv = find_preview(resource.id, tag_category, [resource_updated]);
                assert(prv);
                resource = resource_updated;
            })
        );
    }); 

    promise.it('can add a request for an already approved resource', () => { 
        const resource__tags = resource.preview.tags;
        const start_time = new Date();

        // if this fails -> problem with test setup
        assert(resource.preview.tags.includes(tag_category2.name)===false, resource, tag_category2);

        return (
            (
                add_resource_to_category(resource, tag_category2)
            )
            .then(() =>
                Thing.database.load.things({
                    type: 'resource',
                    preview: {
                        tags: [tag.name],
                    },
                })
            )
            .then(resources_updated => {
                const resource_updated = resources_updated.find(t => t.id===resource.id);
                const resource_updated__tags = resource_updated.preview.tags;

                assert(resource_updated__tags.includes(tag_category2.name));
                assert(resource__tags.every(tagname => resource_updated__tags.includes(tagname)));
                assert(resource__tags.length + 1 === resource_updated__tags.length);

                assert(resource_updated.preview.tagreqs.length>=2);
                assert(resource_updated.preview.tagreqs.length===2);
                const prv2 = find_preview(resource.id, tag_category2, resources_updated);
                assert(prv2);
                assert(new Date(prv2.req_date) > start_time, '!( '+new Date(prv2.req_date).getTime()+' > '+start_time.getTime()+' )');
                const prv1 = find_preview(resource.id, tag_category, resources_updated);
                assert(prv1);
                assert(new Date(prv1.req_date) < start_time);
                assert(new Date(prv1.req_date) < new Date(prv2.req_date));

                resource = resource_updated;
            })
        );
    }); 

    function add_resource_to_category(resource_info, tag__category) { 
        if( resource_info.type === 'resource' ) {
            const resource = resource_info;
            assert(resource.constructor === Thing);
            resource_info = {};
            ['resource_url', 'github_full_name', 'npm_package_name']
            .forEach(key => resource_info[key] = resource[key])
            for(var key in resource_info) if( ! resource_info[key] ) delete resource_info[key];
        }

        if( Object.keys(resource_info).length === 1 ) {
            assert_chai.deepEqual(Object.keys(resource_info), ['resource_url']);
        } else {
            assert_chai.deepEqual(Object.keys(resource_info).sort(), ['github_full_name', 'npm_package_name']);
        }

        return (
            add_resource(resource_info)
            .then(resource =>
                categorize_resource(resource, tag__category)
                .then(() => resource)
            )
        );
    } 

    function add_resource(resource_info) { 
        assert(author);
        assert(resource_info);
        return (
            new Thing(Object.assign({type: 'resource'}, resource_info, {author}))
            .draft.save()
            .then(([resource_]) => {
                assert(resource_.id);
                assert(resource_.constructor === Thing);
                assert(resource_.type==='resource');
                assert(resource_.github_full_name === resource_info.github_full_name);
                assert(resource_.resource_url === resource_info.resource_url);

                // retrieved info from GitHub
                if( resource_.github_full_name ) {
                    assert(resource_.github_info);
                    if( resource_.github_info._could_not_connect ) {
                        console.warn("warning: coul'd not retrieve GitHub info for `"+resource_.github_full_name+"`");
                    }
                    if( ! resource_.github_info._could_not_connect ) {
                        assert(resource_.github_info.name.toLowerCase()===resource_.github_full_name.split('/')[1].toLowerCase(), '`github_info.name=='+resource_.github_info.name+' && github_full_name=='+resource_.github_full_name+'`');
                        assert(resource_.github_info.readme.constructor === String);
                    }

                    const test_repo = 'brillout/timerlog';
                    assert(resources_info.some(({github_full_name}) => github_full_name===test_repo));
                    if( resource_.github_full_name === test_repo ) {
                        if( ! resource_.github_info._could_not_connect ) {
                            assert(resource_.github_info.readme.includes('[timerlog][40ms] A million random numbers generated'));
                        }
                    }
                }

                // retrieved info from website
                if( resource_.resource_url ) {
                    assert(resource_.html_info);
                    if( resource_.html_info._could_not_connect ) {
                        console.warn("warning: coul'd not retrieve HTML info for `"+resource_.resource_url+"`");
                    }

                    if( ! resource_.html_info._could_not_connect ) {
                        assert(resource_.html_info.html_title);
                    }

                    const test_repo = 'http://brillout.com';
                    assert(resources_info.some(({resource_url}) => resource_url===test_repo));
                    if( resource_.resource_url === test_repo ) {
                        if( ! resource_.html_info._could_not_connect ) {
                            expect(resource_.html_info).to.deep.equal({
                                html_title: 'Romuald Brillout',
                                html_description: 'Romuald Brillout',
                                html_published_at: null,
                                html_created_at: new Date('2011-03-07T23:00:00.000Z'),
                                html_self_url: null,
                            });
                        }
                    }
                }

                assert(tag.id);
                return resource_;
            })
        );
    } 

    function categorize_resource(resource, tag__category) { 
        const assert_soft = assert;
        assert(tag__category.referred_tag_markdown_list);
        assert(tag__category.id);
        return (
            Thing.database.load.things({
                type: 'tag',
                referred_tag_markdown_list: tag__category.referred_tag_markdown_list,
            })
            .then(tag_categories => {

                const current_request = get_request_info.apply(resource, [tag__category.referred_tag_markdown_list, tag_categories]);
                // exact copy of frontend code
                const current_category_id = ((current_request||{}).tag__category||{}).id
                assert_soft(current_request===null || current_category_id);

                const request_date = (() => {
                    // If the resource is already in the category then it's not a request.
                    // Adding a resource to a category it's already in is a way to update its `npm_package_name` or `github_full_name`.
                    if( is_tagged_with(resource, tag__category) ) {
                        return null;
                    }
                    return (current_request||{}).req_date || new Date();
                })();

                const referred_resource = resource.id;
                const referred_tag = tag__category.id;

                return (
                    Promise.all([
                        (
                            new Thing((() => {
                                const info = {
                                    type: 'tagged',
                                    referred_resource,
                                    referred_tag,
                                    is_removed: false,
                                    author,
                                };
                                if( request_date ) {
                                    info.request_date = request_date;
                                }
                                return info;
                            })()).draft.save()
                        ),
                        current_category_id && current_category_id !== referred_tag && (
                            new Thing({
                                type: 'tagged',
                                referred_resource,
                                referred_tag: current_category_id,
                                is_removed: true,
                                author,
                            }).draft.save()
                        ),
                    ])
                );
            })
        );

        function get_request_info(tag__markdown_list__id, tag_categories) { 

            const Tag = {
                get_by_name,
            };
            function get_by_name(name) { return tag_categories.find(tc => tc.name===name); }

            // exact copy of frontend code
            assert_soft(tag__markdown_list__id);
            for(const {req_tag_name, req_date, req_approved} of this.preview.tagreqs) {
                assert_soft(req_tag_name);

                assert([true, false, null].includes(req_approved));
                if( req_approved===true ) {
                    continue;
                }
                const tag__category = Tag.get_by_name(req_tag_name, {can_be_null: true});
                if( ! tag__category ) {
                    continue;
                }
                if( ! tag__category.referred_tag_markdown_list ) {
                    continue;
                }
                if( tag__category.referred_tag_markdown_list !== tag__markdown_list__id ) {
                    continue;
                }

                assert_soft(req_date);
                return {req_date, tag__category};
            }
            return null;
        } 

        function is_tagged_with(resource, tag) { 
            if( resource.preview.tags.includes(tag.name) ) {
                return true;
            }
        } 

    } 

    function approve_category(resource, tag__category) { 
        assert(tag__category.referred_tag_markdown_list);
        assert(tag__category.id);
        return (
            new Thing({
                type: 'tagged',
                referred_resource: resource.id,
                referred_tag: tag__category.id,
                is_removed: false,
                request_approved: true,
                draft: {
                    author,
                },
            }).draft.save()
        );
    } 

    function check_for_tags(things, {strict=true}={}) { 
        let categories = things.filter(t => t.type==='tag' && t.referred_tag_markdown_list);
        let tags_list = things.filter(t => t.type==='tag' && !t.referred_tag_markdown_list);

        if( strict===false ) {
            categories = categories.filter(t => t.referred_tag_markdown_list===tag.id);
            tags_list = tags_list.filter(t => t.id===tag.id);
        }

        assert(categories.length>15);
        assert([tag_category, tag_category2].every(tc => categories.find(({id, name}) => tc.id===id && tc.name===name)));
        assert(categories.every(t => t.referred_tag_markdown_list===tag.id));

        assert(tags_list.length>=1);
        assert(tags_list.length===1);
        assert(tags_list[0].id===tag.id);
        assert(things.is_private() === false);
    } 
    function check_for_resources(things) { 
        const resources_ = things.filter(({type}) => type==='resource');
        assert(resources_.length>0);
        assert(resources__requested.length>0);
        assert(resources_.length >= resources__requested.length);
        resources__requested.forEach(({github_full_name, npm_package_name, resource_url}) => {
            assert(resources_.find(r => r.github_full_name === github_full_name && r.npm_package_name === npm_package_name && r.resource_url === resource_url));
        });
        assert(things.is_private() === false);
    } 

    function find_preview(resource_id, tag__category, things) { 
        const resource = things.find(({id}) => id===resource_id);
        assert(resource);
        return resource.preview.tagreqs.find(({req_tag_name}) => req_tag_name===tag__category.name);
    } 
});

