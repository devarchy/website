"use strict";
const assert = require('assert');
const validator = require('validator');
const tlds = require('tlds');
const Promise = require('bluebird'); Promise.longStackTraces();
const Promise_serial = require('promise-serial');
const npm_api = require('../util/npm-api');
const github_api = require('../util/github-api');
const html_api = require('../util/html-api');
const normalize_url = require('../util/normalize_url');
const parse_markdown_catalog = require('../util/parse_markdown_catalog');


module.exports = {
    user: { 
        github_login: {
            validation: {
                type: String,
                test: val => val.indexOf('/') === -1,
            },
            is_unique: true,
            is_required: true,
        },
        github_info: {
            validation: {
                type: Object,
            },
            value: (thing_self, {Thing}) => { 
                // *** Note on user id VS username ***
                // - official way to retrieve user info; https://api.github.com/users/:username
                // - undocumented working endpoint; https://api.github.com/user/:id
                // - SO about this; http://stackoverflow.com/questions/11976393/get-github-username-by-id
                // - username can be changed; https://help.github.com/articles/changing-your-github-username/

                const github_login = thing_self.github_login;
                assert( github_login );

                const github_info = {};

                return (
                    github_api.user.get_info({login: github_login, max_delay: Thing.http_max_delay, expected_error_status_codes: [404]})
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
                .catch(resp => {
                    if( resp.response_connection_error ) {
                        Object.assign(
                            github_info,
                            thing_self.github_info,
                            { _could_not_connect: true } );
                        return github_info;
                    }
                    throw resp;
                });
            }, 
            is_async: true,
            is_required: true,
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
            is_required: true,
            immutable: true,
            is_unique: true,
            cascade_save: true,
        },
        email: {
            validation: {
                type: String,
                test: val => val===null || val.includes('@') && !/\s/.test(val) && val.length>2,
            },
            value: (thing_self, {Thing}) => { 

                const auth_token = thing_self.auth_token.token;
                assert(auth_token);

                return (
                    github_api.user.get_emails({
                        auth_token,
                        max_delay: Thing.http_max_delay,
                        expected_error_status_codes: [
                            404, // 404 is returned in case user doesn't exist anymore
                            401, // 401 is returned when a token doesn't have enough priviledges (some token don't have read email priviledge)
                        ],
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
            is_async: true,
        },
        auth_token: {
            validation: {
                type: Object,
                test: val => ['github'].includes(val.provider) && (val.token||'').length>5,
            },
            is_required: true,
        },
    }, 
    resource: { 
        _options: { 
            is_required: ['resource_url', 'github_full_name', ],
            // having both the resource and the tag in the `views` property of tagged is enough to view resources of a tag
            // but it isn't enough to view resources in the intersection of several tags
            additional_views: [
                (thing_self, {Thing, transaction}) =>
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
        resource_url: { 
            validation: {
                type: String,
                test: (val, {Thing}) => validate_normalized_url(normalize_url(val), {Thing}),
            },
            is_unique: false, // making `resource_url_normalized` unique is a stronger constraint
        }, 
        resource_url_normalized: { 
            validation: {
                type: String,
                test: (val, {Thing}) => validate_normalized_url(val, {Thing}),
            },
            value: thing_self => {
                if( !thing_self.resource_url ) {
                    return null;
                }
                return normalize_url(thing_self.resource_url);
            },
            is_async: false,
            is_unique: true,
        }, 
        resource_title: { 
            validation: {
                type: String,
            },
        }, 
        resource_description: { 
            validation: {
                type: String,
            },
        }, 
        html_info: { 
            validation: {
                type: Object,
            },
            value: (thing_self, {Thing}) => {
                const url = thing_self.resource_url;
                if( ! url ) {
                    return Promise.resolve(null);
                }
                return (
                    html_api
                    .get_info({
                        url,
                        max_delay: Thing.http_max_delay,
                    })
                    .then(resp => {
                        if( ! resp ) {
                            const url_with_protocol = normalize_url.ensure_protocol_existence(url);
                            throw new Thing.ValidationError([
                                'Could not retrieve information for "'+url_with_protocol+'".',
                                '\n',
                                'Is "'+url_with_protocol+'" a correct address?',
                            ].join(''));
                        }
                        return resp;
                    })
                );
            },
            is_async: true,
        }, 
        github_full_name: { 
            validation: {
                type: String,
                test: val => val.split('/').length === 2,
            },
            is_unique: true,
        }, 
        github_info: { 
            validation: {
                type: Object,
            },
            value: (thing_self, {Thing}) => { 
                // *** Note on user id VS username ***
                // - official way to retrieve user info; https://api.github.com/repos/:full_name
                // - no documentation found for following endpoint (there should be though); https://api.github.com/repositories/:id
                // - repo name can be changed but will be redirected

                if( ! thing_self.github_full_name ) {
                    return Promise.resolve(null);
                }

                // we need that for the TRICK below
                assert( thing_self.github_info===undefined || (thing_self||0).github_info.constructor===Object );

                const github_full_name = thing_self.github_full_name;
                assert( github_full_name );

                const github_info = {};

                return Promise.all([
                    github_api
                        .repo
                        .get_info({
                            full_name: github_full_name,
                            max_delay: Thing.http_max_delay,
                            expected_error_status_codes: [404],
                        })
                        .then( info => {
                            assert( info === null || (info||0).constructor === Object );
                            if( info === null ) {
                                // we need that for the TRICK below
                                assert( thing_self.github_info===undefined || (thing_self||0).github_info.constructor===Object );
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
                        .get_readme({
                            full_name: github_full_name,
                            max_delay: Thing.http_max_delay,
                        })
                        .then( content => {
                            github_info['readme'] = content;
                        })
                ])
                .then(() => {
                    delete github_info._could_not_connect;
                    return github_info;
                })
                .catch(resp => {
                    if( resp.response_connection_error ) {
                        Object.assign(
                            github_info,
                            thing_self.github_info,
                            { _could_not_connect: true } );
                        return github_info;
                    }
                    throw resp;
                });
            }, 
            is_async: true,
        }, 
        npm_package_name: { 
            validation: {
                type: String,
                test: val => val===null || npm_api.is_npm_package_name_valid(val),
            },
            is_unique: true,
        }, 
        npm_info: { 
            validation: {
                type: Object,
                test: val => val===null || (val||{}).name,
            },
            value: (thing_self, {Thing}) => {

                if( ! thing_self.npm_package_name ) {
                    return Promise.resolve(null);
                }

                const npm_info = {};

                return (
                    npm_api.get_package_json(thing_self.npm_package_name)
                )
                .catch(resp => {
                    if( resp.response_status_code === 404 ) {
                        throw new Thing.ValidationError("Could not retrieve package.json from NPM.\nIs "+npm_api.url+thing_self.npm_package_name+" the address of the NPM package?");
                    }
                    throw resp;
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
            is_async: true,
            required_props: ['name'],
        }, 
        preview: { 
            validation: {
                type: Object,
            },
            value: (thing_self, {transaction, Thing}) => {

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
            is_async: true,
            is_required: true,
            required_props: ['tags', 'tagreqs', 'number_of_upvotes', 'number_of_downvotes', 'number_of_comments', ],
        }, 
    }, 
    tag: { 
        _options: {
            side_effects: [ 
                (thing_self, {Thing}) => {
                    if( ! thing_self.markdown_list__github_full_name ) {
                        return null;
                    }

                    assert( thing_self.markdown_list__entries.every(c => c.resources.constructor === Array) );

                    const resources_all = thing_self.markdown_list__entries.map(c => c.resources).reduce((acc, cur) => acc.concat(cur), []);
                    resources_all.every(info => {
                        assert(!!info.as_web_catalog === !info.as_npm_catalog);
                        assert(info.as_npm_catalog===undefined || info.as_npm_catalog.github_full_name && info.as_npm_catalog.npm_package_name);
                        assert(info.as_web_catalog===undefined || info.as_web_catalog.resource_url && info.as_web_catalog.title && info.as_web_catalog.description, JSON.stringify(info, null, 2));
                    });

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
                                resources_all.map(info => () => {
                                    const thing_info = {
                                        type: 'resource',
                                        author: thing__user.id,
                                        draft: {},
                                    };
                                    if( info.as_web_catalog ) {
                                        assert(info.as_web_catalog.resource_url);
                                        assert(info.as_web_catalog.title);
                                        assert(info.as_web_catalog.description);
                                        thing_info.resource_url = info.as_web_catalog.resource_url;
                                        thing_info.resource_title = info.as_web_catalog.title;
                                        thing_info.resource_description = info.as_web_catalog.description;
                                    }
                                    if( info.as_npm_catalog ) {
                                        assert(info.as_npm_catalog.github_full_name && info.as_npm_catalog.npm_package_name);
                                        thing_info.github_full_name = info.as_npm_catalog.github_full_name;
                                        thing_info.npm_package_name = info.as_npm_catalog.npm_package_name;
                                    }
                                    return (
                                        new Thing(thing_info).draft.save()
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
                            resources_all.forEach(info => {
                                if( info.as_npm_catalog ) {
                                    const github_full_name = info.as_npm_catalog.github_full_name;
                                    const npm_package_name = info.as_npm_catalog.npm_package_name;
                                    assert(
                                        things.find(t => t.type === 'resource' && t.github_full_name === github_full_name),
                                        "resource missing in postgres: `{github_full_name: '"+github_full_name+"', npm_package_name: '"+npm_package_name+"'}`"
                                    );
                                }
                                if( info.as_web_catalog ) {
                                    const resource_url = info.as_web_catalog.resource_url;
                                    assert(
                                        things.find(t => t.type==='resource' && t.resource_url === resource_url),
                                        "resource missing in postgres: `{resource_url: '"+resource_url+"'}`"
                                    );
                                }
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
            is_required: true,
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
            value: (thing_self, {Thing}) => {
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
            is_async: true,
        }, 
        markdown_list__declined: { 
            validation: {
                type: Array,
            },
            value: (thing_self, {Thing}) => {
                if( ! thing_self.markdown_list__github_full_name ) {
                    return Promise.resolve(null);
                }

                const markdown_list__github_full_name = thing_self.markdown_list__github_full_name;

                return (
                    github_api.repo.get_file({
                        full_name: markdown_list__github_full_name,
                        max_delay: Thing.http_max_delay,
                        file_path: 'declined.json',
                    })
                    .then(content => {
                        try {
                            return JSON.parse(content);
                        }catch(e) {
                            // we can't assume that package.json is well formated
                            return null;
                        }
                    })
                    .then(content => {
                        if( !content ) {
                            return [];
                        }
                        assert(content.constructor===Object);
                        return Object.keys(content);
                    })
                );
            },
            is_async: true,
        }, 
        markdown_list__entries: { 
            validation: {
                type: Array,
            },
            value: (thing_self, {Thing}) => {
                if( ! thing_self.markdown_list__github_full_name ) {
                    return Promise.resolve(null);
                }

                const markdown_list__github_full_name = thing_self.markdown_list__github_full_name;

                return (
                    github_api.repo.get_readme({
                        full_name: markdown_list__github_full_name,
                        max_delay: Thing.http_max_delay,
                        markdown_parsed: false,
                        dont_use_cache: true,
                    })
                    .then(content => parse_markdown(content))
                );

                function parse_markdown(content) { 
                    if( content === null ) {
                        return null;
                    }

                    return parse_markdown_catalog(content);
                } 
            },
            is_async: true,
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
            is_required: true,
            immutable: true,
            add_to_view: true,
        },
        referred_resource: {
            validation: {
                type: 'Thing.resource',
            },
            is_required: true,
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
                (thing_self, {Thing, transaction}) =>
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
            is_required: true,
            cascade_save: true,
        },
        rejection_argument: {
            validation: {
                type: String,
                test: val => val === null || (val||0).constructor===String && val.length>0,
            },
            is_required: false, // `false` because the absence of `rejection_argument` means "approved"
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
            is_required: true,
        },
        referred_resource: {
            validation: {
                type: 'Thing.resource',
            },
            is_required: true,
            cascade_save: true,
            add_to_view: true,
        },
    }, 
    genericvote: { 
        _options: {
            is_unique: ['author', 'referred_thing', 'vote_type', ],
            // add resource
            additional_views: [ 
                (thing_self, {Thing, transaction}) =>
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
            is_required: true,
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
            is_required: true,
        },
    }, 
};

function validate_normalized_url(val, {Thing}) { 
    const dn = val.split('/')[0];
    const dn_msg = "Domain name `"+dn+"`"+(dn!==val?" (of `"+val+"`)":"");
    if( ! dn.includes('.') ) {
        throw new Thing.ValidationError(dn_msg+" is missing a dot. The domain name needs to have at least one dot like in `example.org`.");
    }
    if( ! validator.isFQDN(dn) ) {
        throw new Thing.ValidationError(dn_msg+" doesn't seem to exist.");
    }
    const tld = dn.split('.').slice(-1)[0];
    if( ! tlds.includes(tld) ) {
        throw new Thing.ValidationError("The root `"+tld+"` (in the domain name `"+dn+"`"+(dn!==val?(" of `"+val+"`"):"")+") doesn't seem to exist.");
    }
    if( val.endsWith('/') ) {
        return false;
    }
    return true;
} 
