"use strict";
const assert = require('assert');
const Promise = require('bluebird'); Promise.longStackTraces();
const Promise_serial = require('promise-serial');
const npm_api = require('../util/npm-api');
const Thing = require('./thingdb');
const github_api = require('../util/github-api');
const parse_markdown_catalog = require('../util/parse_markdown_catalog');

module.exports = {
    user: { 
        github_login: {
            validation: {
                type: String,
                test: val => val.indexOf('/') === -1,
            },
            is_unique: true,
            required: true,
        },
        github_info: {
            validation: {
                type: Object,
            },
            value: thing_self => { 
                // *** Note on user id VS username ***
                // - official way to retrieve user info; https://api.github.com/users/:username
                // - undocumented working endpoint; https://api.github.com/user/:id
                // - SO about this; http://stackoverflow.com/questions/11976393/get-github-username-by-id
                // - username can be changed; https://help.github.com/articles/changing-your-github-username/

                const github_login = thing_self.github_login;
                assert( github_login );

                const github_info = {};

                return (
                    github_api.user.get_info({login: github_login, max_delay: Thing.http_max_delay, expected_status_codes: [404]})
                )
                .then( user_info => {
                    assert( user_info === null || (user_info||0).constructor === Object );
                    if( user_info === null ) {
                        // TODO
                        //  - instead of keeping old github_info, implement proper handling:
                        //    - set `removed=true` when github_info._is_deleted
                        //    - remove thing from table thing_aggregate when `removed===true`
                        Object.assign(
                            github_info,
                            thing_self.github_info,
                            { _is_deleted: true } );
                        return;
                    }
                    assert( user_info.created_at );
                    ["login", "id", "avatar_url", "gravatar_id", "html_url", "type" ,"site_admin" ,"name" ,"company" ,"blog" ,"location" ,"email" ,"hireable" ,"bio" ,"public_repos" ,"public_gists" ,"followers" ,"following" ,"created_at" ,"updated_at" ,]
                    .forEach(p => {
                        assert(user_info[p]!==undefined);
                        github_info[p] = user_info[p];
                    });
                })
                .then(() => {
                    delete github_info._could_not_connect;
                    return github_info;
                })
                .catch(err => {
                    if( Thing.NetworkConnectionError.check_error_object(err) ) {
                        Object.assign(
                            github_info,
                            thing_self.github_info,
                            { _could_not_connect: true } );
                        return github_info;
                    }
                    throw err;
                });
            }, 
            required: true,
        },
    }, 
    user_private_data: { 
        _options: {
            is_private: true,
        },
        referred_user: {
            validation: {
                type: 'Thing.user',
            },
            required: true,
            immutable: true,
            is_unique: true,
            cascade_save: true,
        },
        email: {
            validation: {
                type: String,
                test: val => val===null || val.includes('@') && !/\s/.test(val) && val.length>2,
            },
            value: thing_self => { 

                const auth_token = thing_self.auth_token.token;
                assert(auth_token);

                return (
                    github_api.user.get_emails({
                        auth_token,
                        max_delay: Thing.http_max_delay,
                    })
                )
                .then(emails => {
                    if( emails === null ) {
                        return null;
                    }
                    assert((emails||0).constructor===Array);
                    assert(emails.every(email =>
                        (email.email||'').includes('@') &&
                        [true, false].includes(email.verified) &&
                        [true, false].includes(email.primary)
                    ));

                    if( emails.length === 0 ) {
                        return null;
                    }
                    emails = emails.sort((e1, e2) => {
                        if( e1.verified !== e2.verified ) {
                            if( e1.verified ) {
                                return -1;
                            } else {
                                return 1;
                            }
                        }

                        if( e1.primary !== e2.primary ) {
                            if( e1.primary ) {
                                return -1;
                            } else {
                                return 1;
                            }
                        }

                        return 0;
                    });
                    const email = emails[0].email;
                    assert((email||'').length>2);
                    return email;
                })
            }, 
        },
        auth_token: {
            validation: {
                type: Object,
                test: val => ['github'].includes(val.provider) && (val.token||'').length>5,
            },
            required: true,
        },
    }, 
    resource: { 
        _options: { 
            // having both the resource and the tag in the `views` property of tagged is enough to view resources of a tag
            // but it isn't enough to view resources in the intersection of several tags
            additional_views: [
                (thing_self, transaction) =>
                    Thing.database.load.things(
                        {
                            type: 'tagged',
                            referred_resource: thing_self.id,
                            removed: false,
                        },
                        {transaction}
                    )
                    .then(things_tagged =>
                        things_tagged.map(thing_tagged => thing_tagged.referred_tag)
                    )
            ],
        }, 
        github_full_name: { 
            validation: {
                type: String,
                test: val => val.split('/').length === 2,
            },
            required: true,
            is_unique: true,
        }, 
        github_info: { 
            validation: {
                type: Object,
            },
            value: thing_self => {
                // *** Note on user id VS username ***
                // - official way to retrieve user info; https://api.github.com/repos/:full_name
                // - no documentation found for following endpoint (there should be though); https://api.github.com/repositories/:id
                // - repo name can be changed but will be redirected

                // we need that for the TRICK below
                assert( thing_self.github_info===undefined || (thing_self||0).constructor===Object );

                const github_full_name = thing_self.github_full_name;
                assert( github_full_name );

                const github_info = {};

                return Promise.all([
                    github_api
                        .repo
                        .get_info({full_name: github_full_name, max_delay: Thing.http_max_delay, expected_status_codes: [404]})
                        .then( info => {
                            assert( info === null || (info||0).constructor === Object );
                            if( info === null ) {
                                // we need that for the TRICK below
                                assert( thing_self.github_info===undefined || (thing_self||0).constructor===Object );
                                // TRICK: `thing_self.github_info === undefined` <=> this function is being called for a database insertion (and not a database update)
                                if( thing_self.github_info === undefined ) {
                                    throw new Thing.ValidationError("Could not retrieve repository information from GitHub.\nIs "+github_api.url+github_full_name+" the address of the repository?");
                                }
                                // TODO
                                //  - instead of keeping old github_info, implement proper handling:
                                //    - set `removed=true` when github_info._is_deleted
                                //    - remove thing from table thing_aggregate when `removed===true`
                                Object.assign(
                                    github_info,
                                    thing_self.github_info,
                                    { _is_deleted: true } );
                                return;
                            }
                            assert( info.created_at );
                            [
                                'id',
                                'name',
                                'full_name',
                                'html_url',
                                'description',
                                'created_at',
                                'updated_at',
                                'pushed_at',
                                'homepage',
                                'size',
                                'stargazers_count',
                                'language',
                                'forks',
                                'open_issues_count',
                                'network_count',
                                'subscribers_count',
                            ].forEach(p => { assert(info[p]!==undefined, p); github_info[p] = info[p]; });
                        }),
                    github_api
                        .repo
                        .get_readme({full_name: github_full_name, max_delay: Thing.http_max_delay})
                        .then( content => {
                            github_info['readme'] = content;
                        })
                ])
                .then(() => {
                    delete github_info._could_not_connect;
                    return github_info;
                })
                .catch(err => {
                    if( Thing.NetworkConnectionError.check_error_object(err) ) {
                        Object.assign(
                            github_info,
                            thing_self.github_info,
                            { _could_not_connect: true } );
                        return github_info;
                    }
                    throw err;
                });
            },
            required: true,
        }, 
        npm_package_name: { 
            validation: {
                type: String,
                test: val => val===null || npm_api.is_npm_package_name_valid(val),
            },
            required: true,
        }, 
        npm_info: { 
            validation: {
                type: Object,
                test: val => val===null || (val||{}).name,
            },
            value: thing_self => {

                if( ! thing_self.npm_package_name ) {
                    return Promise.resolve(null);
                }

                const npm_info = {};

                return (
                    npm_api.get_package_json(thing_self.npm_package_name)
                )
                .catch(err => {
                    if( err.message === 'Package `' + thing_self.npm_package_name + '` doesn\'t exist' ) {
                        throw new Thing.ValidationError("Could not retrieve package.json from NPM.\nIs "+npm_api.url+thing_self.npm_package_name+" the address of the NPM package?");
                    }
                    throw err;
                })
                .then(package_json => {

                    assert( (package_json.name||'').toLowerCase() === thing_self.npm_package_name.toLowerCase() );
                    [
                        'name',
                        'description',
                        'keywords',
                    ]
                    .forEach(prop => {
                        npm_info[prop] = package_json[prop] !== undefined ? package_json[prop] : null;
                    });

                    assert(npm_info.keywords===null || (npm_info.keywords||0).constructor===Array);

                    return npm_info;
                })
            },
            required: false,
            required_props: ['name'],
        }, 
        preview: { 
            validation: {
                type: Object,
             // test: val => val && (val.tags||0).constructor === Array && (val.tagreqs||0).constructor === Array,
            },
            value: (thing_self, transaction) => {

                assert( thing_self.id );
                assert( thing_self.type === 'resource' );
                assert( transaction && transaction.rid );

                const preview = {
                    tags: [],
                    tagreqs: [],
                    number_of_comments: 0,
                    number_of_upvotes: 0,
                    number_of_downvotes: 0,
                };

                return (
                    Thing.database.load.view([{id: thing_self.id}], {transaction})
                )
                .then(referrers => {
                    referrers
                    .forEach(referrer => {
                        add_tag(referrer, referrers);
                        add_tagrequests(referrer, referrers);
                        add_numbers(referrer);
                        add_taggeredreview_numbers(referrer);
                    });
                })
                .then(() => preview);

                assert(false);

                function add_tag(tag, referrers) { 
                    if( tag.type !== 'tag' ) {
                        return;
                    }
                    const corresponding_tagged_found =
                        referrers.some( t =>
                            t.type === 'tagged' &&
                            t.referred_resource === thing_self.id &&
                            t.referred_tag === tag.id );
                    assert(corresponding_tagged_found);
                    assert(tag.name);
                    preview.tags.push(tag.name);
                } 

                function add_tagrequests(tagged, referrers) { 
                    if( tagged.type !== 'tagged' ) {
                        return;
                    }
                    const tag = referrers.find(t => t.id === tagged.referred_tag);
                    assert(tag);
                    assert(tag.type==='tag');
                    assert(tag.name);

                    if( ! tagged.tagrequest ) {
                        return;
                    }
                    assert(tagged.tagrequest.constructor === String && tagged.tagrequest.length > 0);
                    preview.tagreqs.push({
                        tagname: tag.name,
                        category: tagged.tagrequest,
                    });
                } 

                function add_numbers(referrer) { 
                    if( referrer.type === 'comment' ) {
                        preview.number_of_comments++;
                    }
                    if( referrer.type === 'genericvote' && referrer.referred_thing === thing_self.id ) {
                        if( referrer.is_negative ) {
                            preview.number_of_downvotes++;
                        } else {
                            preview.number_of_upvotes++;
                        }
                    }
                } 

                function add_taggeredreview_numbers(referrer) { 
                    if( referrer.type === 'taggedreview' ) {
                        if( referrer.rejection_argument ) {
                            preview.number_of_downvotes++;
                        }
                        else {
                            preview.number_of_upvotes++;
                        }
                    }
                } 

            },
            required: true,
            required_props: ['tags', 'tagreqs', ],
        }, 
        stability: { 
            validation: {
                test: val => ['production', 'beta', 'experimental', ].includes(val),
                type: String,
            },
        }, 
    }, 
    tag: { 
        _options: {
            side_effects: [ 
                thing_self => {
                    if( ! thing_self.markdown_list__github_full_name ) {
                        return null;
                    }

                    assert( thing_self.markdown_list__data.every(c => c.resources.constructor === Array) );

                    const resources_all = thing_self.markdown_list__data.map(c => c.resources).reduce((acc, cur) => acc.concat(cur), []);
                    assert(resources_all.every(({github_full_name, npm_package_name}) => github_full_name && npm_package_name));

                    return () => {
                        return (
                            save_resources(resources_all)
                        )
                        .then(() =>
                            check_if_all_resources_are_created(resources_all)
                        )
                        .then(() => {});
                    };

                    function save_resources(resources_all) {
                        assert(thing_self.id);
                        return (
                            new Thing({
                                type: 'user',
                                github_login: 'devarchy-bot',
                                draft: {},
                            })
                            .draft.save()
                        )
                        .then(([thing__user]) =>
                            Promise_serial(
                                resources_all.map(({github_full_name, npm_package_name}) => () => {
                                    return (
                                        new Thing({
                                            type: 'resource',
                                            github_full_name,
                                            npm_package_name,
                                            author: thing__user.id,
                                            draft: {},
                                        }).draft.save()
                                    )
                                    .then(([thing__resource]) =>
                                        new Thing({
                                            type: 'tagged',
                                            referred_resource: thing__resource.id,
                                            referred_tag: thing_self.id,
                                            author: thing__user.id,
                                            removed: false,
                                            draft: {},
                                        }).draft.save()
                                    )
                                }),
                                {parallelize: 50, log_progress: 'markdown list entries upserted to devarchy'}
                            )
                        );
                    }

                    function check_if_all_resources_are_created(resources_all) {
                        return (
                            Thing.database.load.things({
                                type: 'resource',
                                preview: {tags: [thing_self.name]},
                            })
                        )
                        .then(things => {
                            resources_all.forEach(({github_full_name, npm_package_name}) => {
                                assert(
                                    things.find(t =>
                                        t.type === 'resource' &&
                                     // t.github_full_name === github_full_name && t.npm_package_name === npm_package_name
                                        t.github_full_name === github_full_name
                                    ),
                                    "resource missing in postgres: `{github_full_name: '"+github_full_name+"', npm_package_name: '"+npm_package_name+"'}`"
                                );
                            });
                        });
                    }

                },
            ], 
        },
        name: { 
            validation: {
                type: String,
                test: val => /^[0-9a-z\-\:]+$/.test(val),
            },
            required: true,
            is_unique: true,
        }, 
        title: { 
            validation: {
                type: String,
            },
        }, 
        definition: { 
            validation: {
                type: String,
            },
        }, 
        markdown_list__github_full_name: { 
            validation: {
                type: String,
                test: val => val.split('/').length === 2,
            },
            is_unique: true,
        }, 
        markdown_list__description: { 
            validation: {
                type: String,
            },
            value: thing_self => {
                if( ! thing_self.markdown_list__github_full_name ) {
                    return Promise.resolve(null);
                }
               return (
                    github_api.repo.get_info({
                        full_name: thing_self.markdown_list__github_full_name,
                        max_delay: Thing.http_max_delay,
                    })
                    .then(({description}) => description)
                );
            },
        }, 
        markdown_list__data: { 
            validation: {
                type: Array,
            },
            value: thing_self => {
                if( ! thing_self.markdown_list__github_full_name ) {
                    return Promise.resolve(null);
                }

                const markdown_list__github_full_name = thing_self.markdown_list__github_full_name;

                return (
                    github_api.repo.get_readme({
                        full_name: markdown_list__github_full_name,
                        max_delay: Thing.http_max_delay,
                        markdown_parsed: false,
                    })
                    .then(content => parse_markdown(content))
                );

                function parse_markdown(content) { 
                    if( content === null ) {
                        return null;
                    }

                    return parse_markdown_catalog(
                        content,
                        {
                            style: 'npm_catalog',
                            processor: (type, data) => {
                                if( type === 'header' && data.text.toLowerCase().includes('learning material') ) {
                                    return null;
                                }
                                return data;
                            },
                        }
                    );
                } 
            },
        }, 
        parent_tag: { 
            validation: {
                type: 'Thing.tag',
            },
        }, 
    }, 
    tagged: { 
        _options: {
            is_unique: ['referred_tag', 'referred_resource', ],
        },
        referred_tag: {
            validation: {
                type: 'Thing.tag',
            },
            required: true,
            immutable: true,
            add_to_view: true,
        },
        referred_resource: {
            validation: {
                type: 'Thing.resource',
            },
            required: true,
            immutable: true,
            add_to_view: true,
            cascade_save: true,
        },
        tagrequest: {
            validation: {
                // not a Boolean but a String because we save the category to which the resource should be added to
                type: String,
            },
        },
        removed: {
            validation: {
                type: Boolean,
            },
         // allow_multiple_authors: true,
        },
    }, 
    taggedreview: { 
        _options: {
            is_unique: ['author', 'referred_tagged', ],
            // add resource to views
            additional_views: [
                (thing_self, transaction) =>
                    Thing.database.load.things({id: thing_self.referred_tagged}, {transaction})
                    .then(([thing__tagged]) => {
                        assert( thing__tagged.type === 'tagged' );
                        return [thing__tagged.referred_resource];
                    })
            ],
        },
        referred_tagged: {
            validation: {
                type: 'Thing.tagged',
            },
            add_to_view: true,
            required: true,
            cascade_save: true,
        },
        rejection_argument: {
            validation: {
                type: String,
                test: val => val === null || (val||0).constructor===String && val.length>0,
            },
            required: false, // `false` because the absence of `rejection_argument` means "approved"
        },
    }, 
    comment: { 
        text: {
            validation: {
                type: String,
            },
        },
        referred_thing: {
            validation: {
                type: ['Thing.comment', 'Thing.resource', ],
            },
            required: true,
        },
        referred_resource: {
            validation: {
                type: 'Thing.resource',
            },
            required: true,
            cascade_save: true,
            add_to_view: true,
        },
    }, 
    genericvote: { 
        _options: {
            is_unique: ['author', 'referred_thing', 'vote_type', ],
            // add resource
            additional_views: [ 
                (thing_self, transaction) =>
                    Thing.database.load.things({id: thing_self.referred_thing}, {transaction})
                    .then(things => {
                        assert( things.length === 1);
                        return things
                        .map(thing => {
                            assert( ['comment', 'resource' ].includes(thing.type) );
                            if( thing.type === 'resource' ) {
                                return thing.id;
                            }
                            assert(thing.type==='comment');
                            assert(thing.referred_resource);
                            return thing.referred_resource;
                        })
                        .filter(thing => thing!==null);
                    })
            ], 
        },
        vote_type: {
            validation: {
                test: val => ['upvote', ].includes(val),
                type: String,
            },
            required: true,
        },
        is_negative: {
            validation: {
                type: Boolean,
            },
        },
        referred_thing: {
            validation: {
                type: ['Thing.comment', 'Thing.resource', ],
            },
            cascade_save: true,
            required: true,
        },
    }, 
};
