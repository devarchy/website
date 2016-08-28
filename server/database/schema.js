"use strict";
const assert = require('assert');
const Promise = require('bluebird');
const Promise_serial = require('promise-serial');
const npm_api = require('../util/npm-api');
const Thing = require('./thingdb');
const github_api = require('../util/github-api');


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
                };

                return (
                    Thing.database.load.view([{id: thing_self.id}], {transaction})
                )
                .then(referrers => {
                    referrers
                    .forEach(referrer => {
                        add_tag(referrer, referrers);
                        add_tagrequests(referrer, referrers);
                    });
                })
                .then(() => preview);

                assert(false);

                function add_tag(referrer, referrers) {
                    if( referrer.type !== 'tag' ) {
                        return;
                    }
                    const tag = referrer;
                    const corresponding_tagged_found =
                        referrers.some( tagged =>
                            tagged.type === 'tagged' &&
                            tagged.referred_resource === thing_self.id &&
                            tagged.referred_tag === tag.id );
                    assert(corresponding_tagged_found);
                    assert(tag.name);
                    preview.tags.push(tag.name);
                }

                function add_tagrequests(referrer) {
                    if( referrer.type !== 'tagged' ) {
                        return;
                    }
                    const tagged = referrer;
                    if( ! tagged.tagrequest ) {
                        return;
                    }
                    assert(tagged.tagrequest.constructor === String && tagged.tagrequest.length > 0);
                    preview.tagreqs.push(tagged.tagrequest);
                }

            },
            required: true,
            required_props: ['tags', 'tagreqs', ],
        }, 
    }, 
    tag: { 
        _options: {
            side_effects: [ 
                thing_self => {
                    if( ! thing_self.markdown_list__github_full_name ) {
                        return null;
                    }

                    assert( thing_self.markdown_list__data );
                    assert( thing_self.markdown_list__data.resources_all );

                    return () => {
                        const resources = process_resources_info(thing_self.markdown_list__data.resources_all);
                        return (
                            save_resources(resources)
                        )
                        .then(() =>
                            check_if_all_resources_are_created(resources)
                        )
                        .then(() => {});
                    };

                    function process_resources_info(resources) {
                        return (
                            resources
                        )
                        .map(({github_full_name, npm_package_name}) =>
                            github_full_name ? ({npm_package_name, github_full_name}) : null
                        )
                        .filter(v => !!v);
                    }

                    function save_resources(resources) {
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
                                resources.map(({github_full_name, npm_package_name}) => () => {
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

                    function check_if_all_resources_are_created(resources) {
                        return (
                            Thing.database.load.things({
                                type: 'resource',
                                preview: {tags: [thing_self.name]},
                            })
                        )
                        .then(things => {
                            resources.forEach(({github_full_name, npm_package_name}) => {
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
                type: Object,
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
                    // TODO: use https://github.com/chjj/marked

                    if( content === null ) {
                        return null;
                    }

                    let ancestor_headers = [{
                        subheaders: [],
                        resources: [],
                        resources_all: [],
                        header_level: 0,
                        header_description: null,
                    }];

                    content
                    .split('\n')
                    .forEach(line => {
                        const header = (() => { 
                            const re = /^\s*#+\s*(?=[^#\s])/;
                            if( ! re.test(line) ) {
                                return null;
                            }
                            return {
                                text: clean_text(line.replace(re, '')),
                                header_level: (() => {
                                    const match = (line.match(re)||[])[0];
                                    assert(match);
                                    assert(match.includes('#'));
                                    return match.length - match.replace(/#/g, '').length;
                                })(),
                                resources: [],
                                resources_all: [],
                                subheaders: [],
                                header_description: null
                            };

                            function clean_text(str) {
                                return str.replace(/\s*\[.*/,'');
                            }
                        })(); 

                        const resource = (() => { 
                            if( header !== null ) {
                                return null;
                            }
                            const re_link = /^\s*-\s*\[([^\]]+)\]\((http[^\)]+)\)/;

                            if( ! re_link.test(line) ) {
                                return null;
                            }

                            const match = line.match(re_link);
                            assert(match && match.length >= 3);
                            if( match.length > 3 ) {
                                return null;
                            }

                            const text = match[1];
                            const link = match[2];

                            let github_full_name = null;
                            {
                                const github_url_start = 'https://github.com/';
                                if( link.startsWith(github_url_start) ) {
                                    github_full_name = link.slice(github_url_start.length);
                                    assert(github_full_name.split('/').length === 2);
                                }
                            }

                            let npm_package_name = null;
                            if( github_full_name && npm_api.is_npm_package_name_valid(text) ) {
                                 npm_package_name = text;
                            }

                            assert( (github_full_name===null) === (npm_package_name===null), "`text==='"+text+"' && link==='"+link+"'`" );

                            return {
                                raw: {
                                    text,
                                    link,
                                },
                                github_full_name,
                                npm_package_name,
                            };
                        })(); 

                        const header_description = (() => { 
                            if( header !== null || resource !== null ) {
                                return null;
                            }

                            const parent_header = ancestor_headers.slice(-1)[0];
                            if( parent_header.resources.length > 0 ) {
                                return null;
                            }

                            const re_desc = /^[\s]*\*[^\*]+\*[\s]*$/;
                            if( ! re_desc.test(line) ) {
                                return null;
                            }

                            const header_description = line.trim().replace(/\*/g, '');
                            return {text:header_description};
                        })(); 

                        if( resource ) {
                            ancestor_headers.forEach((h, i) => {
                                h.resources_all.push(resource);
                            });
                            const parent_header = ancestor_headers.slice(-1)[0];
                            parent_header.resources.push(resource);
                        }

                        if( header_description ) {
                            const parent_header = ancestor_headers.slice(-1)[0];
                            parent_header.header_description = header_description;
                        }

                        if( header ) {
                            ancestor_headers = ancestor_headers.filter(h => h.header_level < header.header_level);
                            assert(ancestor_headers.length >= 1 && ancestor_headers[0].header_level===0, 'ancestor_headers should always contain root header');
                            ancestor_headers.push(header);
                            assert(ancestor_headers.every((h, i) => i===0 || h.header_level > ancestor_headers[i-1].header_level));
                            const parent_header = ancestor_headers.slice(-2,-1)[0];
                            assert(parent_header);
                            assert(parent_header.subheaders, JSON.stringify(parent_header, null, 2));
                            parent_header.subheaders.push(header);
                        }
                    });

                    let root_header = ancestor_headers[0];

                    prune_empty_headers(root_header);
                    function prune_empty_headers(h) {
                        h.subheaders = h.subheaders.filter(h => h.resources_all.length !== 0);
                        h.subheaders.forEach(h => prune_empty_headers(h));
                    }

                    if( root_header.subheaders.length === 1 ) {
                        root_header = root_header.subheaders[0];
                    }

                    if( ! root_header.text ) {
                        root_header.text =
                            markdown_list__github_full_name
                            .split('/')[1]
                            .split('-')
                            .filter(str => str.length > 0)
                            .map(str => str.length < 4 ? str : str.slice(0,1).toUpperCase()+str.slice(1))
                            .join(' ');
                    }

                    return root_header;
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
};
