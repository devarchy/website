"use strict";
const assert = require('assert');
const assert_hard = require('assertion-soft/hard');
const assert_soft = require('assertion-soft');
const validator = require('validator');
const tlds = require('tlds');
const Promise = require('bluebird'); Promise.longStackTraces();
const Promise_serial = require('promise-serial');
const npm_api = require('../util/npm-api');
const github_api = require('../util/github-api');
const gitlab_api = require('../util/gitlab-api');
const html_api = require('../util/html-api');
const normalize_url = require('../util/normalize_url');
const parse_markdown_catalog = require('../util/parse_markdown_catalog');
const clean_sentence = require('clean-sentence');
const chalk = require('chalk');


module.exports = {
    user: { 
        _options: { 
            is_required: ['github_login', 'facebook_user_id', 'twitter_user_id', ],
        }, 
        github_login: { 
            validation: {
                type: String,
                test: val => val.indexOf('/') === -1,
            },
            is_unique: true,
        }, 
        github_info: { 
            validation: {
                type: Object,
            },
            value: (thing_self, {Thing, schema__args}) => {
                // *** Note on user id VS username ***
                // - official way to retrieve user info; https://api.github.com/users/:username
                // - undocumented working endpoint; https://api.github.com/user/:id
                // - SO about this; http://stackoverflow.com/questions/11976393/get-github-username-by-id
                // - username can be changed; https://help.github.com/articles/changing-your-github-username/

                const github_login = thing_self.github_login;

                if( !github_login ) {
                    return Promise.resolve(null);
                }

                const data_promise = (
                    (
                        github_api.user.get_info({
                            login: github_login,
                            max_delay: Thing.http_max_delay,
                            expected_error_status_codes: [404],
                            cache__entry_expiration: schema__args.cache_expiration_limit,
                        })
                    )
                    .then( user_info => {
                        assert( user_info === null || (user_info||0).constructor === Object );
                        if( !user_info ) {
                            return user_info;
                        }
                        const data = {};
                        ["login", "id", "avatar_url", ]
                        .forEach(p => {
                            assert(user_info[p]!==undefined);
                            data[p] = user_info[p];
                        });
                        return data;
                    })
                );

                return (
                    handle_api_problems({
                        data_promise,
                        data_current: thing_self.github_info,
                        Thing,
                        data_constructor: Object,
                        is_removed: thing_self.is_removed,
                        schema__args,
                    })
                );
            },
            is_async: true,
        }, 
        twitter_user_id: { 
            validation: {
                type: String,
            },
            is_unique: true,
        }, 
        twitter_info: { 
            validation: {
                type: Object,
            },
        }, 
        facebook_user_id: { 
            validation: {
                type: String,
            },
            is_unique: true,
        }, 
        facebook_info: { 
            validation: {
                type: Object,
            },
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
        auth_token: { 
            validation: {
                type: Object,
                test: val => (val.token||'').length>5,
            },
            is_required: true,
        }, 
        email: { 
            validation: {
                type: String,
                test: val => val===null || val.includes('@') && !/\s/.test(val) && val.length>2,
            },
            value: thing_self => { 
                return (
                    (thing_self.github_info||{}).email ||
                    (thing_self.facebook_info||{}).email ||
                    null
                );
            }, 
        }, 
        twitter_info: { 
            validation: {
                type: Object,
            },
        }, 
        facebook_info: { 
            validation: {
                type: Object,
            },
        }, 
        github_info: { 
            validation: {
                type: Object,
            },
            value: (thing_self, {Thing, schema__args}) => { 

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
                        cache__entry_expiration: schema__args.cache_expiration_limit,
                    })
                )
                .catch(err => {
                    if( err.response_connection_error ) {
                        return null;
                    }
                    throw err;
                })
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
                    return {email};
                })
            }, 
            is_async: true,
        }, 
    }, 
    resource: { 
        _options: { 
            // having both the resource and the tag in the `views` property of tagged is enough to view resources of a tag
            // but it isn't enough to view resources in the intersection of several tags
            additional_views: [ 
                (thing_self, {Thing, transaction}) => {
                    let views = [];
                    return (
                        Thing.database.load.things(
                            {
                                type: 'tagged',
                                referred_resource: thing_self.id,
                            },
                            {transaction}
                        )
                        .then(taggeds => {
                            views = [
                                ...views,
                                ...taggeds.map(tagged => tagged.referred_tag),
                            ];
                            return taggeds;
                        })
                        .then(taggeds =>
                            Promise.all(
                                taggeds
                                .map(({referred_tag}) =>
                                    Thing.database.load.things(
                                        {
                                            type: 'tag',
                                            id: referred_tag,
                                        },
                                        {transaction}
                                    )
                                    .then(([tag]) => tag)
                                )
                            )
                        )
                        .then(tags => {
                            views = [
                                ...views,
                                ...(
                                    tags
                                    .filter(tag => tag.referred_tag_markdown_list)
                                    .map(tag => tag.referred_tag_markdown_list)
                                )
                            ];
                        })
                        .then(() => views)
                    );
                }
            ], 
        }, 
        _subtypes: {
            resource_website: {
                resource_url: { 
                    validation: {
                        type: String,
                        test: (val, {Thing}) => validate_normalized_url(normalize_url(val), {Thing}),
                    },
                    is_unique: false, // making `resource_url_normalized` unique is a stronger constraint
                    is_required: true,
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
                html_info: { 
                    validation: {
                        type: Object,
                    },
                    value: (thing_self, {Thing, schema__args}) => {
                        const url = thing_self.resource_url;

                        if( ! url ) {
                            return Promise.resolve(null);
                        }

                        const data_promise = (
                            html_api
                            .get_info({
                                url,
                                max_delay: Thing.http_max_delay,
                            })
                        );

                        const url_with_protocol = normalize_url.ensure_protocol_existence(url);
                        const error_on_empty_response = (
                            [
                                'Could not retrieve information for "'+url_with_protocol+'".',
                                '\n',
                                'Is "'+url_with_protocol+'" the correct address?',
                            ].join('')
                        );

                        return (
                            handle_api_problems({
                                data_promise,
                                data_current: thing_self.html_info,
                                error_on_empty_response,
                                Thing,
                                data_constructor: Object,
                                is_removed: thing_self.is_removed,
                                schema__args,
                            })
                        );
                    },
                    is_async: true,
                }, 
                crowded__name: { 
                    validation: {
                        type: String,
                    },
                }, 
                crowded__description: { 
                    validation: {
                        type: String,
                    },
                }, 
                crowded__show_description: { 
                    validation: {
                        type: Boolean,
                    },
                }, 
                crowded__published_at: { 
                    validation: {
                        type: String,
                    },
                }, 
            },
            resource_github_repository: {
                github_full_name: { 
                    // *** Note on user id VS username ***
                    // - official way to retrieve user info; https://api.github.com/repos/:full_name
                    // - no documentation found for following endpoint (there should be though); https://api.github.com/repositories/:id
                    // - repo name can be changed but will be redirected
                    validation: {
                        type: String,
                        test: validate_github_full_name,
                    },
                    is_unique: true,
                    is_required: true,
                }, 
                github_info: { 
                    validation: {
                        type: Object,
                    },
                    value: (thing_self, {Thing, schema__args}) => {
                        const github_full_name = thing_self.github_full_name;
                        return retrieve_github_info({github_full_name, thing_self, Thing, schema__args});
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
                resource_title: { 
                    validation: {
                        type: String,
                    },
                }, 
            },
            resource_devarchy_list: {
                referred_tag: { 
                    validation: {
                        type: 'Thing.tag',
                    },
                    is_required: true,
                    is_unique: true,
                    cascade_save: {
                        transitive_cascade: true,
                    },
                }, 
                github_info: { 
                    validation: {
                        type: Object,
                    },
                    value: (thing_self, {transaction, Thing, schema__args}) => {
                        assert(thing_self.referred_tag);
                        return (
                            Thing.database.load.things({id: thing_self.referred_tag}, {transaction})
                            .then(([tag]) => {
                                const github_full_name = tag.markdown_list__github_full_name;
                                assert(github_full_name);
                                return retrieve_github_info({github_full_name, thing_self, Thing, schema__args});
                            })
                        );
                    },
                    is_async: true,
                }, 
                preview_tag: { 
                    validation: {
                        type: Object,
                    },
                    value: (thing_self, {transaction, Thing}) => {
                        return (
                            Thing.database.load.things({id: thing_self.referred_tag}, {transaction})
                            .then(([tag]) => {
                                return ({name: tag.name, markdown_list__github_full_name: tag.markdown_list__github_full_name});
                            })
                        );
                    },
                    is_async: true,
                }, 
            },
        },
        preview: { 
            validation: {
                type: Object,
            },
            value: (thing_self, {transaction, Thing}) => {

                assert( thing_self.id );
                assert( thing_self.type === 'resource' );
                assert( transaction && transaction.rid );

                return (
                    Thing.database.load.view([{id: thing_self.id}], {transaction, show_removed_things: true})
                )
                .then(referrers_all => {

                    const referrers = referrers_all.filter(r => r.is_removed===false);

                    const {tags, tagreqs} = get_tags(referrers_all);
                    const number_of_comments = get_number({type: 'comment', referrers});
                    const number_of_upvotes = get_number({type: 'genericvote', vote_type: 'upvote', is_negative: false, referrers}) + get_implicit_selfupvote(referrers_all);
                    const number_of_downvotes = get_number({type: 'genericvote', vote_type: 'upvote', is_negative: true, referrers});
                    const reviewpoints = get_reviewpoints(referrers);

                    return {
                        tags,
                        tagreqs,
                        number_of_comments,
                        number_of_upvotes,
                        number_of_downvotes,
                        reviewpoints,
                    };

                })

                assert(false);

                function get_tags(referrers_all) { 
                    const tags = [];
                    const tagreqs = [];

                    referrers_all.forEach(referrer => {
                        if( referrer.type !== 'tagged' ) {
                            return;
                        }

                        const tagged = referrer;

                        if( ! tagged.referred_tag ) {
                            assert_hard(false);
                            return;
                        }
                        if( tagged.referred_resource !== thing_self.id ) {
                            assert_hard(false);
                            return;
                        }
                        assert_hard([true, false, undefined].includes(tagged.request_approved));
                        assert_hard(!('request_date' in tagged) || tagged.request_date===null || new Date(tagged.request_date).getTime()>0);

                        const {tag_catalog, tag_category} = (() => { 
                            const tag = referrers_all.find(t => t.id === tagged.referred_tag);
                            if( !assert_hard(tag) ) return;
                            if( !assert_hard(tag.type==='tag') ) return;
                            if( !assert_hard(tag.name) ) return;
                            assert_hard([false, true].includes(tag.is_removed), tag);

                            if( ! tag.referred_tag_markdown_list ) {
                             // assert_soft(false);
                                return {
                                    tag_catalog: tag,
                                    tag_category: null,
                                };
                            }

                            return {
                                tag_catalog: referrers_all.find(t => t.id === tag.referred_tag_markdown_list),
                                tag_category: tag,
                            };
                        })(); 

                        assert_hard(tag_category===null || tag_category.referred_tag_markdown_list);
                        if( tag_category && ! tag_category.is_removed && ! tagged.is_removed ) {
                            tags.push(tag_category.name);

                            if( tagged.request_date || [false].includes(tagged.request_approved)) {
                                tagreqs.push({
                                    req_tag_name: tag_category.name,
                                    req_approved: tagged.request_approved===undefined ? null : tagged.request_approved,
                                    req_date: tagged.request_date===undefined ? null : new Date(tagged.request_date),
                                });
                            }
                        }

                        if( ! assert_hard(tag_catalog) ) return;
                        assert_hard(tag_catalog.is_removed===false, tag_category, tag_catalog);
                        tags.push(tag_catalog.name);
                    });

                    assert_hard(tags.every(tagname => tagname && tagname.constructor===String), tags);
                    assert_hard(tagreqs.every(tr => (
                        tr &&
                        (
                            tr.req_tag_name &&
                            tr.req_tag_name.constructor === String
                        ) &&
                        [true, false, null].includes(tr.req_approved) &&
                        (
                            tr.req_date===null ||
                            tr.req_date.constructor===Date
                         // new Date(tr.req_date).getTime() > 0
                        )
                    )), tagreqs);

                    return {
                        tags: Array.from(new Set(tags)).filter(Boolean),
                        tagreqs,
                    };
                } 

                function get_number({type, vote_type, is_negative, referrers}) { 
                    let number = 0;
                    referrers.forEach(referrer => {
                        if( referrer.type !== type ) {
                            return;
                        }
                        if( referrer.referred_thing !== thing_self.id ) {
                            return;
                        }
                        if( vote_type !== undefined && referrer.vote_type !== vote_type ) {
                            return;
                        }
                        if( is_negative !== undefined  && !!referrer.is_negative !== !!is_negative ) {
                            return;
                        }
                        number++;
                    });
                    return number;
                } 

                function get_implicit_selfupvote(referrers_all) { 
                    const author_has_voted = referrers_all.some(({type, vote_type, referred_thing, author}) => type === 'genericvote' && vote_type==='upvote' && referred_thing===thing_self.id && author === thing_self.author);
                    return author_has_voted ? 0 : 1;
                } 

                function get_reviewpoints(referrers) { 
                    const rps_map = {};

                    referrers
                    .filter(t => t.type === 'reviewpoint' )
                    .forEach(rp => {
                        rps_map[rp.id] = rp;
                    });

                    const votes = {};

                    referrers
                    .filter(t => t.type === 'genericvote' )
                    .forEach(vote => {
                        const rp = rps_map[vote.referred_thing];
                        if( !rp ) return;
                        assert_soft(rp.id === vote.referred_thing);
                        votes[rp.id] = (votes[rp.id] || 0) + (vote.is_negative ? -1 : 1);
                    });

                    const LENGTH_MAX = 200;
                    let LENGTH_CURR = 0;

                    const reviewpoints = [];

                    Object.values(rps_map)
                    .sort((rp1, rp2) => (votes[rp2.id]||0) - (votes[rp1.id]||0))
                    .some(({text, is_negative}) => {
                        reviewpoints.push({text, is_negative});
                        LENGTH_CURR += (text||'').length;
                        return LENGTH_CURR > LENGTH_MAX;
                    });

                    return reviewpoints;
                } 

            },
            is_async: true,
            is_required: true,
            required_props: ['tags', 'tagreqs', 'number_of_upvotes', 'number_of_downvotes', 'number_of_comments', 'reviewpoints', ],
        }, 
    }, 
    tag: { 
        _options: { 
            side_effects: [
                {
                    apply_outside_transaction: true,
                    side_effect_computation: add_things(),
                },
                {
                    /*
                      - wihtin transaction side effects are not implemented
                        - ain't trivial: How do you rollback something in the side effect?
                    apply_outside_transaction: false,
                    */
                    apply_outside_transaction: true,
                    side_effect_computation: tag_rename__recompute_resources,
                },
            ],
            graveyard: [
                'markdown_list__entries',
                'markdown_list__declined',
                'markdown_list__description',
                'description',
            ],
            additional_views: [
                (thing_self, {Thing, transaction}) => {
                    if( ! thing_self.markdown_list__github_full_name ) {
                        return Promise.resolve([]);
                    }
                    return (
                        Thing.database.load.things(
                            {
                                type: 'resource',
                                referred_tag: thing_self.id,
                            },
                            {transaction}
                        )
                        .then(([resource]) => {
                            if( !resource ) {
                                return [];
                            }
                            return (
                                Promise.all(
                                    resource.preview.tags
                                    .map(name =>
                                        Thing.database.load.things({
                                            type: 'tag',
                                            name,
                                        })
                                        .then(([tag]) => {
                                            assert_hard(tag.id);
                                            return tag.id;
                                        })
                                    )
                                )
                            );
                        })
                    );
                }
            ],
        }, 
        title: { 
            validation: {
                type: String,
            },
        }, 
        name: { 
            validation: {
                type: String,
                test: tag_name_test,
            },
            is_required: true,
            is_unique: true,
        }, 
        _subtypes: {
            tag_markdown_list_github: {
                markdown_list__github_full_name: { 
                    validation: {
                        type: String,
                        test: validate_github_full_name,
                    },
                    is_unique: true,
                    is_required: true,
                }, 
                markdown_text: { 
                    validation: {
                        type: String,
                    },
                    value: (thing_self, {Thing, schema__args}) => {
                            assert(thing_self.markdown_list__github_full_name);

                            const full_name = thing_self.markdown_list__github_full_name;
                            const max_delay = Thing.http_max_delay;

                            const cache__entry_expiration = (
                                !schema__args.is_a_test_run && -1 ||
                                schema__args.cache_expiration_limit
                            );

                            const data_promise = (
                                (
                                    full_name==='brillout/awesome-vue' &&
                                        github_api.repo.get_file({
                                            file_path: 'README_CLEANED.md',
                                            full_name,
                                            max_delay,
                                            cache__entry_expiration,
                                        })
                                ) || (
                                    full_name==='brillout/awesome-react-components' &&
                                        gitlab_api.repo.get_readme({
                                            full_name,
                                            max_delay,
                                            markdown_parsed: false,
                                            cache__entry_expiration,
                                            branch: 'needs',
                                        })
                                ) || (
                                    github_api.repo.get_readme({
                                        full_name,
                                        max_delay,
                                        markdown_parsed: false,
                                        cache__entry_expiration,
                                    })
                                )
                            );

                            return (
                                handle_api_problems({
                                    data_promise,
                                    data_current: thing_self.markdown_text,
                                    Thing,
                                    error_on_empty_response: "Can't retrieve readme for `"+thing_self.markdown_list__github_full_name+"`",
                                    data_constructor: String,
                                    is_removed: thing_self.is_removed,
                                    schema__args,
                                })
                            );

                    },
                    is_async: true,
                }, 
                preview: { 
                    validation: {
                        type: Object,
                    },
                    is_async: true,
                    value: (thing_self, {transaction, Thing}) => {
                        const preview = {
                            tags: [thing_self.name],
                        };

                        assert_hard(thing_self.id);

                        return (
                            Thing.database.load.things({
                                type: 'resource',
                                referred_tag: thing_self.id,
                            }, {transaction})
                            .then(things => {
                                assert_hard(things.length<=1);
                                const resource = things[0];
                                if( resource ) {
                                    assert_hard(resource.preview.tags);
                                    preview.tags = [...preview.tags, ...resource.preview.tags];
                                }
                            })
                            .then(() => preview)
                        );
                    },
                }, 
            },
            tag_markdown_list_raw: {
                markdown_text: { 
                    validation: {
                        type: String,
                    },
                    is_required: true,
                }, 
                preview: { 
                    validation: {
                        type: Object,
                    },
                    is_async: false,
                    value: thing_self => ({tags: [thing_self.name]}),
                }, 
            },
            tag_markdown_category: {
                referred_tag_markdown_list: { 
                    validation: {
                        type: 'Thing.tag',
                    },
                    is_required: true,
                    add_to_view: true,
                }, 
                parent_category: { 
                    validation: {
                        type: 'Thing.tag',
                    },
                }, 
                entries_type: { 
                    validation: {
                        type: String,
                    },
                }, 
                category_description: { 
                    validation: {
                        type: String,
                    },
                }, 
                category_order: { 
                    validation: {
                        type: Number,
                        test: int => int>=0 && int|0===int,
                    },
                    is_required: true,
                }, 
                name: { 
                    validation: {
                        test: str => {
                            if( (str||{}).constructor!==String ) {
                                return false;
                            }
                            const parts = str.split(':');
                            if( parts.length!==2 ) {
                                return false;
                            }
                            if( !tag_name_test(parts[0]) ) {
                                return false;
                            }
                            if( !parts[1].split('_').every(tag_name_test) ) {
                                return false;
                            }
                            return true;
                        },
                    },
                }, 
                preview: { 
                    validation: {
                        type: Object,
                    },
                    is_async: true,
                    value: (thing_self, {transaction, Thing}) => {
                        const preview = {
                            tags: [],
                        };

                        assert_hard(thing_self.referred_tag_markdown_list);

                        return (
                            Thing.database.load.things({
                                id: thing_self.referred_tag_markdown_list,
                            }, {transaction})
                            .then(things => {
                                assert_hard(things.length<=1);
                                assert_hard(things.length===1, thing_self.name);
                                const tag = things[0];
                                assert_hard(tag.name);
                                preview.tags.push(tag.name);
                            })
                            .then(() => preview)
                        );
                    },
                }, 
            },
            tag_npm_list: {
                npm_tags: { 
                    validation: {
                        type: Array,
                    },
                    is_required: true,
                }, 
                name: { 
                    validation: {
                        test: str => (str||{}).constructor===String && str.startsWith('npm_') && tag_name_test(str.slice('npm_'.length)),
                    },
                }, 
                preview: { 
                    validation: {
                        type: Object,
                    },
                    is_async: false,
                    value: thing_self => ({tags: [thing_self.name]}),
                }, 
            },
        },
    }, 
    tagged: { 
        _options: {
            is_unique: ['referred_tag', 'referred_resource', ],
            additional_views: [
                (thing_self, {Thing, transaction}) =>
                    Thing.database.load.things(
                        {id: thing_self.referred_tag},
                        {transaction}
                    )
                    .then(([tag]) => {
                        const ref_id = tag.referred_tag_markdown_list;
                        if( ! ref_id ) {
                            return [];
                        }
                        assert(validator.isUUID(ref_id));
                        return [ref_id];
                    })
            ],
            graveyard: [
                'tagrequest',
            ],
        },
        referred_tag: {
            validation: {
                type: 'Thing.tag',
            },
            is_required: true,
         // immutable: true,
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
        request_approved: {
            validation: {
                type: Boolean,
            },
        },
        request_date: {
            validation: {
                type: Date,
            },
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
                type: ['Thing.comment', 'Thing.resource', 'Thing.reviewpoint', ],
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
                            assert( ['comment', 'resource', 'reviewpoint', ].includes(thing.type) );
                            if( thing.type === 'resource' ) {
                                return thing.id;
                            }
                            assert(thing.referred_resource);
                            return thing.referred_resource;
                        })
                        .filter(thing => thing!==null);
                    })
            ], 
        },
        vote_type: {
            validation: {
                test: val => ['upvote', 'agreeing', ].includes(val),
                type: String,
            },
            is_required: true,
        },
        is_negative: {
            validation: {
                type: Boolean,
            },
            is_required: true,
            default_value: false,
        },
        referred_thing: {
            validation: {
                type: ['Thing.comment', 'Thing.resource', 'Thing.reviewpoint', ],
            },
            cascade_save: true,
            is_required: true,
        },
    }, 
    reviewpoint: { 
        text: {
            validation: {
                type: String,
            },
            is_required: true,
        },
        explanation: {
            validation: {
                type: String,
            },
        },
        referred_resource: {
            validation: {
                type: 'Thing.resource',
            },
            is_required: true,
            cascade_save: true,
            add_to_view: true,
        },
        is_negative: {
            validation: {
                type: Boolean,
            },
            is_required: true,
            default_value: false,
        },
    }, 
    _options: {
        graveyard: [ 
            'taggedreview',

        ], 
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

function tag_name_test(str) { 
    return (
        /^[0-9a-z\-]+$/.test(str)
    );
} 

function validate_github_full_name(str) { 
    return (
        str.split('/').length === 2 &&
        ! str.includes('#')
    );
} 

function retrieve_github_info({github_full_name, thing_self, Thing, schema__args}) { 
    if( ! github_full_name ) {
        return Promise.resolve(null);
    }

    // we need that for the TRICK below
    assert( thing_self.github_info===undefined || (thing_self||0).github_info.constructor===Object );

    const github_info = {};

    const error_on_empty_response = "Could not retrieve repository information from GitHub.\nIs "+github_api.url+github_full_name+" the address of the repository?";

    const info_promise = (() => {
        const data_promise = (
            github_api
            .repo
            .get_info({
                full_name: github_full_name,
                max_delay: Thing.http_max_delay,
                expected_error_status_codes: [404],
                cache__entry_expiration: schema__args.cache_expiration_limit,
            })
            .then( info => {
                assert( info === null || (info||0).constructor === Object );
                if( info === null ) {
                    return null;
                }
                assert_hard( info.created_at );
                const ret = {};
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
                    'stargazers_count',
                    'language',
                    'open_issues_count',
                    'subscribers_count',
                ].forEach(p => { assert_soft(info[p]!==undefined, p); ret[p] = info[p]; });
                return ret;
            })
        );

        const data_current = !thing_self.github_info ? undefined : Object.assign({}, thing_self.github_info);
        delete (data_current||{}).readme;

        return (
            handle_api_problems({
                data_promise,
                data_current,
                error_on_empty_response,
                Thing,
                data_constructor: Object,
                is_removed: thing_self.is_removed,
                schema__args,
            })
        );
    })();

    const readme_promise = (() => {
        const data_promise = (
            github_api
            .repo
            .get_readme({
                full_name: github_full_name,
                max_delay: Thing.http_max_delay,
                cache__entry_expiration: schema__args.cache_expiration_limit,
            })
        );
        const data_current = !thing_self.github_info ? undefined : thing_self.github_info.readme;
        return (
            handle_api_problems({
                data_promise,
                data_current,
                error_on_empty_response,
                Thing,
                data_constructor: String,
                is_removed: thing_self.is_removed,
                schema__args,
            })
        );
    })();

    return (
        Promise.all([
            info_promise
            .then(info => {
                assert_soft(!('readme' in info));
                Object.assign(github_info, info);
            }),
            readme_promise
            .then(readme => {
                if( readme ) {
                    github_info.readme = readme;
                }
            }),
        ])
        .then(() => github_info)
    );
} 

function add_things() { 

    const MANUAL_TAGGING = { 
        'react': {
            'react-plyr': {
                op_move: 'react:video',
            },
            'react-howler': {
                op_move: 'react:audio',
            },
            'react-component-data': {
                op_move: 'react:audio',
            },
            'react-lottie': {
                op_move: 'react:animation-utilities',
            },
            'react-masonry-mixin': {
                op_move: 'react:masonry-layout',
            },
            'react-tag-box': {
                op_move: 'react:tags-input',
            },
            'cx-core': {
                op_move: 'react:miscellaneous',
            },
            'generact': {
                op_move: 'react:boilerplate',
            },

            'react-bootstrap-datetimepicker': {
                op_reject: true,
            },
            'react-swipe-views': {
                op_reject: true,
            },
            'ryanflorence/react-magic-move': {
                op_reject: true,
            },

            'react-tween': {
                op_move: 'react:animation-utilities',
                op_reject: true,
            },
            'react-swipe-views': {
                op_move: 'react:tabs',
                op_reject: true,
            },

            'reselect': {
                op_remove: true,
            },
            'redux-batched-actions': {
                op_remove: true,
            },
            'redux-batched-subscribe': {
                op_remove: true,
            },
            'remote-redux-devtools': {
                op_remove: true,
            },
            'redux-devtools-dock-monitor': {
                op_remove: true,
            },
            'redux-devtools-chart-monitor': {
                op_remove: true,
            },
            'redux-devtools': {
                op_remove: true,
            },
            'redux-devtools-inspector': {
                op_remove: true,
            },
            'redux-devtools-log-monitor': {
                op_remove: true,
            },
            'redux-devtools-filterable-log-monitor': {
                op_remove: true,
            },
            'redux-ui': {
                op_remove: true,
            },
            'redux-ava': {
                op_remove: true,
            },
            'redux-test-recorder': {
                op_remove: true,
            },

            'redux': {
                op_remove: true,
            },
            'apollo-client': {
                op_remove: true,
            },
            'react-datagrid': {
                op_remove: true,
            },
            'react-date-picker': {
                op_remove: true,
            },
            'webpack-isomorphic-tools': {
                op_remove: true,
            },
            'isomorphic-style-loader': {
                op_remove: true,
            },
            'gl-react-dom': {
                op_remove: true,
            },

            'cerebral-module-http': {
                op_remove: true,
            },
            'stardust': {
                op_remove: true,
            },

        },
    }; 

    const CATALOGS = { 
        'vuejs/awesome-vue': 'vue',
        'brillout/awesome-vue': 'vue',
        'brillout/awesome-react-components': 'react',
        'brillout/awesome-angular-components': 'angular',
        'brillout/awesome-redux': 'redux',
        'brillout/awesome-web-apps': 'web-apps',
        'brillout/awesome-frontend-libraries': 'frontend',
    }; 

    const md_handler = { 
        cat: {
            get_title(cat_info) {
                return cat_info.text;
            },
            get_description(cat_info) {
                return cat_info.header_description;
            },
            get_id(cat_info) {
                return cat_info.id;
            },
            get_parent_id(cat_info) {
                return cat_info.parent_category_id;
            },
            get_cat_info(id, categories_info) {
                return (
                    categories_info
                    .find(cat_info => this.get_id(cat_info)===id)
                );
            },
            get_resources(cat_info) {
                return cat_info.resources;
            },
        },
        res: {
            match_thing(resource_info, resource_thing) {
                if( resource_info.as_npm_package ) {
                    const github_full_name = resource_info.as_npm_package.github_full_name;
                    const npm_package_name = resource_info.as_npm_package.npm_package_name;
                    return (
                        github_full_name === resource_thing.github_full_name ||
                        npm_package_name === resource_thing.npm_package_name
                    );
                }
                if( resource_info.as_github_repository ) {
                    assert_soft(resource_thing.preview_tag || resource_thing.github_full_name, JSON.stringify(resource_thing, null, 2));
                    const github_full_name = resource_info.as_github_repository.github_full_name;
                    if( resource_thing.preview_tag ) {
                        return (
                            github_full_name === resource_thing.preview_tag.markdown_list__github_full_name
                        );
                    }
                    return (
                        github_full_name === resource_thing.github_full_name
                    );
                }
                if( resource_info.as_website_url ) {
                    return resource_info.as_website_url.resource_url === resource_thing.resource_url;
                }
                assert_hard(false);
            },
        },
    }; 

    const DEBUG_MODE = false;

    const reporter = create_reporter();

    return (thing_self, {Thing, schema__args}) => {
        if( ! thing_self.markdown_text ) {
            return null;
        }

        const ignore_categories = ['Learning Material', 'Community'];

        let categories_to_include;
        let correct_wrong_url = false;
        let entries_to_prune;
        const is_awesome_vue = (thing_self.markdown_list__github_full_name||'').includes('awesome-vue');
        if( is_awesome_vue ) { 
            correct_wrong_url = true;
            categories_to_include = ['Components & Libraries'];
            entries_to_prune = entry => {
                const as_github_repository = entry.processed.as_github_repository;
                const as_npm_package = entry.processed.as_npm_package;
                const as_website_url = entry.processed.as_website_url;
                if( as_github_repository && as_github_repository.github_full_name.toLowerCase()==='jetbrains/intellij-plugins') {
                    return true;
                }
                if( as_github_repository && as_github_repository.github_full_name.toLowerCase()==='jrainlau/vue-flatpickr') {
                    return true;
                }
                if( as_npm_package && as_npm_package.npm_package_name.toLowerCase()==='vue-multiple-pages' ) {
                    return true;
                }
                if( as_npm_package && as_npm_package.npm_package_name.toLowerCase()==='vue-typescript-boilerplate' ) {
                    return true;
                }
                if( as_website_url && !as_github_repository && !as_npm_package ) {
                    return true;
                }
                return false;
            }
        } 

        const categories_info = (() => { 
            let categories_info = parse_markdown_catalog(
                thing_self.markdown_text,
                {
                    categories_to_include,
                    entries_to_prune,
                    processors: {
                        as_github_repository: {
                            correct_wrong_url,
                        },
                    }
                }
            );

            assert_hard(
                categories_info.every(cat_info => md_handler.cat.get_resources(cat_info).every(resource_info => resource_info.as_website_url))
            );

            const normalize = str => str.toLowerCase().replace(/[^a-z]/g, '');

            categories_info = (
                categories_info
                .filter(cat_info => {
                    const title = normalize(md_handler.cat.get_title(cat_info));
                    return (
                        ! ignore_categories.some(title_i => title === normalize(title_i))
                    );
                })
            );

            return categories_info;
        })(); 

        const resources_info = get_all_resources({categories_info});

        const tag_catalog = thing_self;
        assert_hard(tag_catalog.name);
        assert_hard(tag_catalog.id);

        return (
            () => {
                let author;
                let resources__all;
                let categories__current;
                let categories__updated;
                let categories__to_merge;
                let taggings__md;
                return (
                    (
                        upsert_bot({Thing})
                        .then(author_ => author = author_)
                    )
                    .then(() =>
                        Thing.database.load.things({preview: {tags: [tag_catalog.name]}})
                        .then(things => {
                            resources__all = things.filter(t => t.type==='resource');
                            categories__current = things.filter(t => t.type==='tag' && t.referred_tag_markdown_list);
                            assert_hard(categories__current.every(t => t.referred_tag_markdown_list===tag_catalog.id));
                        })
                    )
                    .then(() =>
                        (
                            add_resources({tag_catalog, resources_info, resources__all, Thing, author, schema__args})
                            .then(resources => {
                                resources__all = assign_array(resources__all, resources, resource => resource.id);
                            })
                        )
                    )
                    .then(() =>
                        update_categories({tag_catalog, categories_info, categories__current, resources__all, Thing, author})
                        .then(({categories__updated: cu, categories__to_merge: cm, taggings__md: tm}) => {
                            // we can't merge categories__updated into categories__current and we need to keep categories__current because it holds old category names
                            categories__updated = cu;
                            categories__to_merge = cm;
                            taggings__md = tm;
                        })
                    )
                    .then(() =>
                        update_taggings({tag_catalog, resources__all, categories__current, categories__updated, categories__to_merge, categories__current, taggings__md, Thing, author})
                    )
                    .then(() =>
                        recompute_resources({tag_catalog, Thing})
                    )
                    .then(() =>
                        check_for_orphans({tag_catalog, Thing})
                    )
                    .then(() =>
                        check_if_all_resources_are_created({tag_catalog, resources_info, Thing})
                    )
                    .then(() =>
                        check_if_md_taggings_are_missing({tag_catalog, taggings__md, Thing})
                    )
                    .then(() => {
                        if( schema__args.is_a_test_run ) return;
                        reporter.report_info();
                        reporter.report_errors();
                    })
                    .then(() => {})
                );
            }
        );
    }

    function update_taggings({tag_catalog, taggings__md, resources__all, categories__current, categories__updated, categories__to_merge, Thing, author}) { 
        assert_hard(tag_catalog.name);

        const {taggeds_to_reject, taggeds_to_add, taggeds_to_remove, taggeds_to_alter} = (() => { 
            const taggeds_to_reject = [];
            const taggeds_to_alter = [];
            const taggeds_to_add = [];
            const taggeds_to_remove = [];

            resources__all
            .forEach(resource => {
                const r_categories__md = (
                    taggings__md
                    .filter(({resource: r}) => r.id===resource.id)
                    .map(({tag_category}) => {
                        assert_hard(tag_category.id && tag_category.type==='tag' && tag_category.referred_tag_markdown_list);
                        return tag_category;
                    })
                );

                const r_categories__db = (
                    resource.preview.tags
                    .filter(tag_name => tag_name.startsWith(tag_catalog.name+':'))
                    .map(category_name => {
                        assert_hard(category_name);
                        const tag_category = categories__updated.find(t => t.name===category_name) || categories__current.find(t => t.name===category_name);
                        assert_hard(tag_category, categories__updated.map(tg => tg.name).sort(), categories__current.map(tg => tg.name).sort(), category_name, resource.preview, resource.npm_package_name);
                        assert_hard(tag_category.id, tag_category, category_name);
                        return tag_category;
                    })
                );

                const manual_op = (() => {
                    const operation = (MANUAL_TAGGING[tag_catalog.name]||[])[resource.npm_package_name] || {};

                    if( operation.op_approve ) {
                        const tag_name = operation.op_approve;
                        assert_hard(tag_name);

                        if( r_categories__md.find(({name}) => {assert_hard(name); return name===tag_name;}) ) {
                            delete operation.op_approve;
                        } else {
                            const tag_category = categories__updated.find(t => t.name===tag_name);
                            assert_hard(tag_category);
                            operation.op_approve = tag_category;
                        }
                    }

                    if( operation.op_move ) {
                        const tag_name = operation.op_move;
                        assert_hard(tag_name, operation, resource);

                        const tag_category = categories__updated.find(t => t.name===tag_name);
                        assert_hard(tag_category, tag_name);
                        operation.op_move = tag_category;
                    }

                    return operation;
                })();

                let r_categories__old = r_categories__db;

                let r_categories__new = [
                    ...r_categories__md,
                    ...(manual_op.op_approve ? [manual_op.op_approve] : []),
                ];

                reporter.log_info({
                    type: 'resource_categories',
                    npm_package_name: resource.npm_package_name,
                    r_categories__old: r_categories__old.map(t => t.name),
                    r_categories__new: r_categories__old.map(t => t.name),
                    manual_op: JSON.stringify(manual_op),
                });

                { // manual mapping
                    const moved = {};
                    if( manual_op.op_move ) {
                        const from = moved.from = (
                            (
                                r_categories__old
                                .filter(req_approved_value([true, undefined], resource))
                                [0]
                            ) ||
                            (
                                r_categories__old
                                .filter(req_approved_value(null, resource))
                                [0]
                            ) ||
                            (
                                r_categories__old
                                .filter(req_approved_value(false, resource))
                                [0]
                            )
                        );

                        const to = moved.to = manual_op.op_move;

                        assert_hard(from && to, resource, to, from, resource.npm_package_name);

                        change_tagging(from, to);
                    }
                    if( manual_op.op_remove ) {
                        r_categories__old
                        .forEach(remove_tagging);
                        r_categories__old.length = 0;
                        r_categories__new.length = 0;
                    }
                    if( manual_op.op_reject ) {
                        r_categories__old
                        .filter(req_approved_value([true, undefined, null], resource))
                        .forEach(reject_tagging(true));
                        r_categories__old.length = 0;
                        r_categories__new.length = 0;
                    }

                    if( moved.from ) {
                        assert_hard(moved.to);
                        const {from, to} = moved;
                        r_categories__old = (
                            r_categories__old
                            .filter(tg => {assert_hard(tg.id && from.id); return tg.id!==from.id})
                        )
                        r_categories__new = (
                            r_categories__new
                            .filter(tg => {assert_hard(tg.id && to.id); return tg.id!==to.id})
                        )
                    }
                }

                { // resource removal per markdown removal
                    if( r_categories__new.length===0 ) {
                        if( r_categories__old.filter(req_approved_value([true, undefined], resource)).length > 0 ) {
                            r_categories__old
                            .filter(req_approved_value([true, undefined, null], resource))
                            .forEach(reject_tagging());
                            r_categories__old.length = 0;
                        }
                    }
                }

                { // handle unchanged taggings
                    r_categories__new = (
                        r_categories__new
                        .filter(tag_category__md => {
                            const idx = r_categories__old.findIndex(tag_category => tag_category.id===tag_category__md.id);
                            if( idx===-1 ) {
                                return true;
                            }
                            r_categories__old.splice(idx, 1);
                            add_tagging(tag_category__md);
                            return false;
                        })
                    );
                }

                { // merge mapping
                    r_categories__old = (
                        r_categories__old
                        .filter(tag_category => {
                            assert_hard(tag_category.name);
                            const merge = categories__to_merge[tag_category.name];
                            if( merge ) {
                                assert_hard(merge.merge_from.id);
                                assert_hard(merge.merge_to.id);

                                const idx = r_categories__new.findIndex(({id}) => {assert_hard(id); return id===merge.merge_to.id});
                                if( idx!==-1 ) {
                                    r_categories__new.splice(idx, 1);
                                }

                                change_tagging(merge.merge_from, merge.merge_to, idx!==-1);

                                assert_hard(tag_category.id===merge.merge_from.id);
                                return false;
                            }
                            return true;
                        })
                    );
                }

                { // random re-use of taggings
                    r_categories__old = (
                        r_categories__old
                        .filter(req_approved_value([true, undefined], resource))
                    );

                    while( r_categories__new.length > 0 && r_categories__old.length > 0 ) {
                        const tag_category__new = r_categories__new[0];
                        const tag_category__old = (
                            (
                                r_categories__old
                                .filter(req_approved_value(null, resource))
                                [0]
                            ) || (
                                r_categories__old
                                .filter(req_approved_value(true, resource))
                                [0]
                            ) || (
                                r_categories__old
                                .filter(req_approved_value(undefined, resource))
                                [0]
                            )
                        );
                        assert_hard(tag_category__new.id);
                        assert_hard(tag_category__old.id);

                        const total_count = r_categories__old.length+r_categories__new.length;

                        r_categories__old = (
                            r_categories__old
                            .filter(r => {assert_hard(r.id); return r.id!==tag_category__old.id})
                        );

                        r_categories__new = (
                            r_categories__new
                            .filter(r => {assert_hard(r.id); return r.id!==tag_category__new.id})
                        );

                        assert_hard(total_count - 2 === r_categories__old.length + r_categories__new.length);

                        change_tagging(tag_category__old, tag_category__new, true);
                    }

                    if( r_categories__old.length===0 ) {
                        r_categories__new
                        .forEach(add_tagging)
                        r_categories__new.length = 0;
                    }

                    assert_hard(r_categories__new.length===0);
                    r_categories__old
                    .filter(req_approved_value([true, undefined], resource))
                    .forEach(remove_tagging);
                    r_categories__old.length = 0;
                }

                assert_hard(r_categories__new.length===0);
                assert_hard(r_categories__old.length===0);

                return;

                function reject_tagging(is_expected) {
                    return tag_category => {
                        assert_hard(!req_approved_value(false, resource)(tag_category), resource, tag_category, 'resource is already rejected');

                        if( ! is_expected ) {
                            reporter.log_error({type: 'rejection', resource, tag_category});
                        }

                        taggeds_to_reject.push({
                            tag_category,
                            resource,
                        });
                    };
                }
                function change_tagging(tag_category__old, tag_category__new, approve) {
                    assert_hard(tag_category__old.id);
                    assert_hard(tag_category__new.id);
                    assert_hard(tag_category__old.name);
                    assert_hard(tag_category__new.name);
                    assert_hard(tag_category__old.name!==tag_category__new.name, tag_category__old, tag_category__new, 'moving a category to itself');

                    taggeds_to_alter.push({
                        resource,
                        tag_category__new,
                        tag_category__old,
                        approve,
                    });

                    taggeds_to_alter
                    .forEach(({tag_category__new, resource}, i) =>
                        assert_hard(
                            taggeds_to_alter.slice(i+1).find(alt => (
                                alt.resource.id === resource.id &&
                                alt.tag_category__new.id === tag_category__new.id
                            ))===undefined,
                            taggeds_to_alter.filter(t => t.resource===resource).map(t => [t.resource.npm_package_name, t.tag_category__old.name, t.tag_category__new.name]),
                            resource.npm_package_name,
                            tag_category__new.name
                        )
                    );
                }
                function add_tagging(tag_category) {
                    taggeds_to_add.push({
                        resource,
                        tag_category,
                    });
                }
                function remove_tagging(tag_category) {
                    taggeds_to_remove.push({
                        resource,
                        tag_category,
                    });
                }
            });

            return {taggeds_to_add, taggeds_to_remove, taggeds_to_reject, taggeds_to_alter};
        })(); 

        taggeds_to_reject
        .forEach(({tag_category, resource}) => {
            reporter.log_info({type: 'resource_rejection', resource, tag_category});
        });
        taggeds_to_alter.forEach(({tag_category__old, tag_category__new, resource}) => {
            reporter.log_info({type: 'resource_move', resource, tag_category__old, tag_category__new});
        });
        taggeds_to_add.forEach(({tag_category, resource}) => {
            reporter.log_info({type: 'resource_addition', resource, tag_category});
        });
        taggeds_to_remove.forEach(({tag_category, resource}) => {
            reporter.log_info({type: 'resource_removal', resource, tag_category});
        });

        return (
            Promise.resolve()
            .then(() =>
                Promise_serial(
                    taggeds_to_add
                    .map(({tag_category, resource}) => () =>
                        new Thing({
                            type: 'tagged',
                            referred_tag: tag_category.id,
                            referred_resource: resource.id,
                            request_approved: true,
                            is_removed: false,
                            author,
                        }).draft.save()
                    )
                    ,
                    {
                        parallelize: 50,
                        log_progress: 'add resources',
                    }
                )
            )
            .then(() =>
                Promise_serial(
                    taggeds_to_alter
                    .map(({tag_category__old, tag_category__new, resource, approve}) => () => { 
                        const referred_resource = resource.id;
                        const referred_tag = tag_category__new.id;
                        const referred_tag__old = tag_category__old.id;
                        const thing_info = {
                            type: 'tagged',
                            referred_tag: referred_tag__old,
                            referred_resource,
                            draft: {
                                referred_tag,
                                author,
                            },
                        };
                        if( approve ) {
                            thing_info.request_approved = true;
                        }
                        return (
                            new Thing(thing_info).draft.save()
                            .catch(err => {
                                const expected_err_msg = 'Thing with type `tagged` and referred_tag `'+referred_tag+'` and referred_resource `'+referred_resource+'` already exists in database';
                                const tagged_already_exists = (
                                    err.constructor === Thing.ValidationError &&
                                    err.message.includes(expected_err_msg)
                                );
                                assert_hard(tag_category__old.id===referred_tag__old);
                                assert_hard(tag_category__new.id===referred_tag);
                                assert_hard(resource.id===referred_resource);
                                if( ! tagged_already_exists ) {
                                    throw err;
                                }

                                const thing_info_2 = {
                                    type: 'tagged',
                                    referred_tag,
                                    referred_resource,
                                    is_removed: false,
                                    author,
                                };

                                if( approve ) {
                                    thing_info_2.request_approved = true;
                                }

                                return (
                                    Promise.all([
                                        new Thing({
                                            type: 'tagged',
                                            referred_tag: referred_tag__old,
                                            referred_resource,
                                            draft: {
                                                is_removed: true,
                                                author,
                                            },
                                        }).draft.save(),
                                        new Thing(thing_info_2).draft.save(),
                                    ])
                                );
                            })
                        );
                    }) 
                    ,
                    {
                        parallelize: 1,
                        log_progress: 'move resources in catalog `'+tag_catalog.name+'`',
                    }
                )
            )
            .then(() =>
                Promise_serial(
                    taggeds_to_reject
                    .map(({tag_category, resource}) => () =>
                        new Thing({
                            type: 'tagged',
                            referred_tag: tag_category.id,
                            referred_resource: resource.id,
                            request_approved: false,
                            is_removed: false,
                            author,
                        }).draft.save()
                    )
                    ,
                    {
                        parallelize: 50,
                        log_progress: 'reject resources',
                    }
                )
            )
            .then(() =>
                Promise_serial(
                    taggeds_to_remove
                    .map(({tag_category, resource}) => () =>
                        new Thing({
                            type: 'tagged',
                            referred_tag: tag_category.id,
                            referred_resource: resource.id,
                            is_removed: true,
                            author,
                        }).draft.save()
                    )
                    ,
                    {
                        parallelize: 50,
                        log_progress: 'remove resources',
                    }
                )
            )
        );
    } 
    function update_categories({tag_catalog, categories_info, categories__current, resources__all, Thing, author}) { 
        assert_hard(resources__all.every(r => r.constructor===Thing && r.type==='resource'), resources__all);
        assert_hard(tag_catalog.id);
        assert_hard(tag_catalog.name);

        const SIMILARITY_THRESHOLD = 0.65;

        return (() => {
            const md_cat_id__to__candidates = find_candidates({tag_catalog, categories_info, categories__current, resources__all});

            const md_cat_id__to__tag_category = {};

            const upserts = (() => { 

                const time_before_save = new Date();

                categories_info
                .forEach((cat_info, category_order) => {
                    const title = md_handler.cat.get_title(cat_info);
                    assert_hard(title);

                    const category_description = md_handler.cat.get_description(cat_info);

                    const cat_id = md_handler.cat.get_id(cat_info);
                    assert_hard(cat_id);
                    assert_hard(tag_catalog.name);
                    const name = tag_catalog.name+':'+cat_id;

                    const entries_type = get_entries_type(md_handler.cat.get_resources(cat_info));

                    const tag_info = {
                        type: 'tag',
                        referred_tag_markdown_list: tag_catalog.id,
                        entries_type,
                        category_description,
                        category_order,
                        name,
                        title,
                        author,
                        parent_category: null,
                        is_removed: false,
                    };
                    const tag_current = (md_cat_id__to__candidates[cat_id]||{}).one_on_one;
                    if( tag_current ) {
                        assert_hard(tag_current.id);
                        tag_info.id = tag_current.id;
                    }
                    md_cat_id__to__tag_category[cat_id] = tag_info;
                });

                add_parent_ids({parent_may_be_missing: true});

                return () => (
                    (
                        upsert_missing_categories()
                    )
                    .then(tags => {
                        tags.forEach(({tag_category, cat_id}) => {
                            md_cat_id__to__tag_category[cat_id].id = tag_category.id;
                        });
                    })
                    .then(() => {
                        add_parent_ids();
                    })
                    .then(() =>
                        upsert_categories()
                    )
                );

                function get_entries_type(resources_info) { 
                    if( resources_info.length === 0 ) {
                        return null;
                    }
                    assert_hard(resources_info.length);
                    const count = {
                        npm_packages: 0,
                        github_repos: 0,
                        website_urls: 0,
                    };
                    resources_info
                    .forEach(resource_info => {
                        if( resource_info.as_npm_package ) {
                            count.npm_packages++;
                            return;
                        }
                        if( resource_info.as_github_repository ) {
                            count.github_repos++;
                            return;
                        }
                        if( resource_info.as_website_url ) {
                            count.website_urls++;
                            return;
                        }
                        assert_hard(false);
                    });

                    const winner = Object.entries(count).sort(([_, c1], [__, c2]) => c2 - c1)[0][0];
                    if( winner === 'github_repos' ) {
                        /*
                        assert_hard(
                            resources_info.every(ri => ri.as_github_repository && !ri.as_npm_package)
                        );
                        */
                        return 'lists_entries';
                    }
                    if( winner === 'npm_packages' ) {
                        return 'npm_entries';
                    }
                    if( winner === 'website_urls' ) {
                        assert_hard(
                            resources_info.every(ri => !ri.as_github_repository && !ri.as_npm_package)
                        );
                        return 'web_entries';
                    }
                    assert_hard(false);
                } 

                function upsert_missing_categories() { 
                    return (
                        Promise_serial(
                            Object.entries(md_cat_id__to__tag_category)
                            .filter(([cat_id, tag_info]) => !tag_info.id)
                            .map(([cat_id, tag_info]) => () =>
                                new Thing(tag_info).draft.save()
                                .then(([tag_category]) => ({tag_category, cat_id}))
                            ),
                            {
                                parallelize: 30,
                                log_progress: 'new categories for catalog `'+tag_catalog.name+'` inserted',
                            }
                        )
                    );
                } 
                function upsert_categories({only_id}={}) { 
                    return (
                        Promise_serial(
                            Object.entries(md_cat_id__to__tag_category)
                            .map(([cat_id, tag_info]) => () => {
                                assert_hard(tag_info.constructor===Object);
                                return (
                                    new Thing(tag_info).draft.save()
                                    .then(([tag_category]) => {
                                        assert_hard(tag_category.history.length>=1, tag_category.history, tag_category);
                                        reporter.log_info({type: 'category_new', tag_category, time_before_save});
                                    })
                                );
                            }),
                            {
                                parallelize: 30,
                                log_progress: 'categories upserted in`'+tag_catalog.name+'`',
                            }
                        )
                    );
                } 

                function add_parent_ids({parent_may_be_missing}={}) { 
                    categories_info
                    .forEach(cat_info => {
                        const parent_cat_id = md_handler.cat.get_parent_id(cat_info);
                        if( parent_cat_id ) {
                            const parent_cat_info = md_handler.cat.get_cat_info(parent_cat_id, categories_info);
                            assert_hard(parent_cat_info, cat_info);
                            assert_hard(parent_cat_id === md_handler.cat.get_id(parent_cat_info));
                            const parent_tag = md_cat_id__to__tag_category[parent_cat_id];
                            assert_hard(parent_tag);
                            const parent_tag_id = parent_tag.id;
                            if( parent_may_be_missing && !parent_tag_id ) {
                                return;
                            }
                            assert_hard(parent_tag_id);
                            assert_hard(validator.isUUID(parent_tag_id));
                            const cat_id = md_handler.cat.get_id(cat_info);
                            assert_hard(cat_id);
                            md_cat_id__to__tag_category[cat_id].parent_category = parent_tag_id;
                        }
                    });
                } 

            })(); 

            const removes = (() => { 
                const categories__mapped = (
                    Object.entries(md_cat_id__to__candidates)
                    .map(([md_cat_id, m])  => {
                        assert_hard(m, md_cat_id, m);
                        assert_hard(m.one_on_one===null || m.one_on_one, md_cat_id, m);
                        return m.one_on_one;
                    })
                    .filter(tc => tc!==null)
                );
                categories__mapped.forEach(tag_category => {
                    assert_hard(categories__current.includes(tag_category), categories__current, md_cat_id__to__candidates, tag_category);
                });
                const categories__to_remove = (
                    [...categories__current]
                    .filter(tag_category => !categories__mapped.includes(tag_category))
                    .filter(tag_category => {
                        assert_hard([true, false].includes(tag_category.is_removed));
                        return !tag_category.is_removed;
                    })
                );
                const promises = (
                    categories__to_remove.map(t => () =>
                        new Thing({
                            id: t.id,
                            type: 'tag',
                            draft: {
                                author,
                                is_removed: true,
                            },
                        }).draft.save()
                        .then(([tag_category]) => {
                            reporter.log_info({type: 'category_removed', tag_category});
                        })
                    )
                );
                return () => (
                    Promise_serial(
                        promises,
                        {
                            parallelize: 30,
                            log_progress: 'categories removed in `'+tag_catalog.name+'`',
                        }
                    )
                );
            })(); 

            return (
                Promise_serial([
                    upserts,
                    removes,
                ])
                .then(() => {
                    check__md_cat_id__to__tag_category({md_cat_id__to__tag_category});

                    const categories__to_merge = compute__categories__to_merge({md_cat_id__to__candidates, md_cat_id__to__tag_category});

                 // const categories__to_move = compute__categories__to_move({md_cat_id__to__candidates, md_cat_id__to__tag_category});

                    const taggings__md = compute__taggings__md({md_cat_id__to__tag_category});

                    const categories__updated = Object.values(md_cat_id__to__tag_category);

                    return {
                        categories__to_merge,
                        taggings__md,
                        categories__updated,
                     // categories__to_move,
                    };
                })
            );
        })();

        function check__md_cat_id__to__tag_category({md_cat_id__to__tag_category}) { 
            const tag_categories = Object.values(md_cat_id__to__tag_category);
            const number_of__tag_categories = (
                Array.from(new Set(
                    tag_categories.map(c => c.id)
                )).length
            );
            const number_of__md_categories = Object.keys(md_cat_id__to__tag_category).length;
            assert_hard(
                number_of__tag_categories===number_of__md_categories,
                tag_categories,
                tag_categories.map(c => c.name),
                Object.keys(md_cat_id__to__tag_category),
                number_of__md_categories, number_of__tag_categories
            );
        } 

        function compute__categories__to_merge({md_cat_id__to__candidates, md_cat_id__to__tag_category}) { 
            const categories__to_merge = {};
            Object.entries(md_cat_id__to__candidates)
            .forEach(([md_cat_id, {merges}]) => {
                merges
                .forEach(candidate => {
                    const {tag_category, match_reason, common_resources_ratio} = candidate;

                    assert_hard(match_reason==='common_resources');
                    assert_hard(common_resources_ratio>=SIMILARITY_THRESHOLD);

                    const merge_from = tag_category;
                    const merge_to = md_cat_id__to__tag_category[md_cat_id];
                    assert_hard(merge_from.id && merge_from.type==='tag' && merge_from.referred_tag_markdown_list);
                    assert_hard(merge_to.id && merge_to.type==='tag' && merge_from.referred_tag_markdown_list);

                    assert_hard(merge_from.id!==merge_to.id, merge_from, merge_to);
                    assert_hard(merge_from.name!==merge_to.name, merge_from, merge_to);

                    const {name} = merge_from;
                    assert_hard(name);

                    const merge_candidate = categories__to_merge[name];
                    if( !merge_candidate || merge_candidate.common_resources_ratio<common_resources_ratio ) {
                        categories__to_merge[name] = {
                            common_resources_ratio,
                            merge_from,
                            merge_to,
                        };
                    }
                })
            });
            return categories__to_merge;
        } 

        /*
        function compute__categories__to_move({md_cat_id__to__candidates, md_cat_id__to__tag_category}) {
            const categories__to_move = {};
            Object.entries(md_cat_id__to__candidates)
            .forEach(([md_cat_id, {one_on_one}]) => {
                const tag_category__md = md_cat_id__to__tag_category[md_cat_id];
                const tag_category__old = one_on_one;

                assert_hard(tag_category__md.id && tag_category__md.type==='tag' && tag_category__md.name);
                assert_hard(tag_category__old.id && tag_category__old.type==='tag' && tag_category__old.name);

                categories__to_move[tag_category__old.name] = {
                    tag_category__md,
                    tag_category__old,
                };
            });
            return categories__to_move;
        }
        */
        function find_candidates({tag_catalog, categories_info, categories__current, resources__all}) { 

            const md_cat_id__to__candidates = {};

            const matchings = (
                [
                    ...match_by_name(),
                    ...match_by_common_resources(),
                ]
            );

            matchings.forEach((match, i) => {
                const match_next = matchings[i+1];
                if( ! match_next ) {
                    return;
                }
                if( match.match_reason==='same_name' ) {
                    return;
                }
                assert_hard(match_next.match_reason!=='same_name');
                assert_hard(match.common_resources_ratio>=match_next.common_resources_ratio);
            });

            const is_one_on_one_target = {};
            matchings
            .filter(({match_reason, common_resources_ratio}) =>
                match_reason==='same_name' || common_resources_ratio >= SIMILARITY_THRESHOLD
            )
            .forEach(match => {
                const {md_cat_id, match_reason, tag_category, common_resources_ratio} = match;
                const md_cat_map = md_cat_id__to__candidates[md_cat_id] = (
                    md_cat_id__to__candidates[md_cat_id] ||
                    {
                        one_on_one: null,
                        merges: [],
                    }
                );

                assert_hard(tag_category.id);

                const is_already_taken = is_one_on_one_target[tag_category.id];
                assert([true, undefined].includes(is_already_taken));

                assert_hard(match_reason!=='same_name' || md_cat_map.one_on_one===null && is_already_taken===undefined);

                if( ! md_cat_map.one_on_one && ! is_already_taken ) {
                    md_cat_map.one_on_one = tag_category;
                    is_one_on_one_target[tag_category.id] = true;
                } else {
                    assert_hard(match_reason==='common_resources');
                    md_cat_map.merges.push(match);
                }
            });

            return md_cat_id__to__candidates;

            function match_by_name() {
                const candidates__by_name = [];
                categories_info.forEach(cat_info => {
                    const md_cat_id = md_handler.cat.get_id(cat_info);
                    categories__current.forEach((tag_category, i) => {
                        if( is_same_name({md_cat_id, tag_category}) ) {
                            candidates__by_name.push({
                                md_cat_id,
                                tag_category,
                                match_reason: 'same_name',
                            });
                        }
                    });
                });
                return candidates__by_name;
            }

            function is_same_name({md_cat_id, tag_category}) {
                assert_hard(md_cat_id);
                assert_hard(tag_category.name);
                const name_parts = tag_category.name.split(':');
                assert_hard(name_parts.length===2);
                assert_hard(name_parts[0]===tag_catalog.name);
                return name_parts[1] === md_cat_id;
            }

            function match_by_common_resources() {
                const categories_current__resources = {};
                resources__all.forEach(resource => {
                    resource.preview.tags
                    .forEach(cat_name => {
                        assert_hard(cat_name);

                        const isnt_approved = req_approved_value([false, null], resource)(cat_name);
                        if( isnt_approved ) {
                            // don't count resources that aren't approved since these are most unlikely listed in the markdown file
                            return;
                        }
                        assert_hard(req_approved_value([true, undefined], resource)(cat_name));

                        categories_current__resources[cat_name] = categories_current__resources[cat_name] || [];
                        categories_current__resources[cat_name].push(resource);
                    });
                });

                const candidates__by_common_resources = [];

                categories_info.forEach(cat_info => {
                    const resources__info = md_handler.cat.get_resources(cat_info);

                    const md_cat_id = md_handler.cat.get_id(cat_info);
                    assert_hard(md_cat_id);

                    categories__current
                    .forEach(tag_category => {
                        if( is_same_name({md_cat_id, tag_category}) ) {
                            return;
                        }

                        const cat_name = tag_category.name;
                        assert_hard(cat_name);
                        const cat_resources = categories_current__resources[cat_name];

                        if( (cat_resources||[]).length === 0 ) {
                            return;
                        }

                        const common_resources_ratio = (
                            (
                                cat_resources
                                .filter(r => resources__info.some(resource_info =>
                                    md_handler.res.match_thing(resource_info, r)
                                ))
                                .length
                            ) / (
                                cat_resources
                                .length
                            )
                        );

                        if( common_resources_ratio === 0 ) {
                            return;
                        }

                        candidates__by_common_resources.push({
                            md_cat_id,
                            match_reason: 'common_resources',
                            common_resources_ratio,
                            number_of_resources: cat_resources.length,
                            tag_category,
                        });
                    });
                });

                candidates__by_common_resources
                .sort(({common_resources_ratio: c1}, {common_resources_ratio: c2}) => {
                    assert_hard(c1.constructor===Number && c2.constructor===Number);
                    return c2 - c1;
                });

                return candidates__by_common_resources;
            }
        } 

        function compute__taggings__md({md_cat_id__to__tag_category}) { 
            assert_hard(md_handler);
            assert_hard(categories_info);
            assert_hard(resources__all);
            assert_hard(md_cat_id__to__tag_category);

            if( DEBUG_MODE ) {
                console.log(
                    JSON.stringify(categories_info, null, 2)
                );
            }

            const taggings__md = [];
            categories_info
            .forEach(cat_info => {
                const md_cat_id = md_handler.cat.get_id(cat_info);
                assert_hard(md_cat_id);
                const tag_category = md_cat_id__to__tag_category[md_cat_id];
                assert_hard(tag_category);
                assert_hard(tag_category.id);
                md_handler.cat.get_resources(cat_info)
                .forEach(resource_info => {
                    const resource = resources__all.find(r => md_handler.res.match_thing(resource_info, r));
                    assert_hard(
                        resource,
                        [
                            JSON.stringify(resource_info, null, 2),
                            'not found in',
                            ...resources__all.map(({github_full_name, npm_package_name, resource_url, preview_tag}) => JSON.stringify({github_full_name, npm_package_name, resource_url, preview_tag}))
                        ].join('\n')
                    );
                    assert_hard(resource.id);
                    taggings__md.push({tag_category, resource});
                })
            });

            return taggings__md;
        } 

    } 

    function get_all_resources({categories_info}) { 
        assert_hard( categories_info.every(c => c.resources.constructor === Array) );

        const markdown_entries = categories_info.map(c => c.resources).reduce((acc, cur) => acc.concat(cur), []);
        markdown_entries.every(info => {
            const debug_info = JSON.stringify(info, null, 2);
            assert_hard(!!info.as_website_url, debug_info);
            assert_hard(!info.as_npm_package || !!info.as_github_repository, debug_info);
            assert_hard(info.as_npm_package===undefined || info.as_npm_package.github_full_name && info.as_npm_package.npm_package_name, debug_info);
            assert_hard(info.as_website_url===undefined || info.as_website_url.resource_url && info.as_website_url.title && info.as_website_url.description.constructor===String, debug_info);
            assert_hard(info.as_github_repository===undefined || info.as_github_repository.github_full_name, debug_info);
        });

        let resources_info = {};
        markdown_entries
        .forEach(info_curr => {
            const tmp_id = (() => { 
                let tmp_id;
                if( info_curr.as_npm_package ) {
                    tmp_id = info_curr.as_npm_package.npm_package_name;
                    assert_hard(tmp_id);
                    return 'npm__'+tmp_id;
                }
                if( info_curr.as_github_repository ) {
                    tmp_id = info_curr.as_github_repository.github_full_name;
                    assert_hard(tmp_id);
                    return 'gh__'+tmp_id;
                }
                if( info_curr.as_website_url ) {
                    tmp_id = info_curr.as_website_url.resource_url;
                    assert_hard(tmp_id);
                    return 'web__'+tmp_id;
                }
                assert_hard(tmp_id);
                return tmp_id;
            })() 

            const info = resources_info[tmp_id] = Object.assign(resources_info[tmp_id]||{}, info_curr);

            if( ! info_curr.as_github_repository ) {
                assert_hard(info.as_website_url);
                assert_hard(info.as_website_url.description, JSON.stringify(info, null, 2));
                info.reviewpoints = info.reviewpoints || [];
                const {description, reviewpoints} = parse_reviewpoints(info.as_website_url.description);
                info.description = description;
                info.reviewpoints = (info.reviewpoints || []).concat(reviewpoints);
            }
        });

        resources_info = Object.values(resources_info);

        return resources_info;
    } 

    function upsert_bot({Thing}) { 
        return (
            new Thing({
                type: 'user',
                github_login: 'devarchy-bot',
                draft: {},
            })
            .draft.save()
        )
        .then(([thing__user]) => thing__user.id);
    } 

    function add_resources({tag_catalog, resources_info, resources__all, Thing, author, schema__args}) { 
        assert_hard(tag_catalog.name);

        return (
            Promise_serial(
                resources_info
                .filter(info => {
                    return true;
                    if( ! info.as_github_repository ) {
                        return true;
                    }
                    const github_full_name = info.as_github_repository.github_full_name;
                    const npm_package_name = (info.as_npm_package||{}).npm_package_name;
                    if( resources__all.find(resource => resource.github_full_name===github_full_name && resource.npm_package_name===npm_package_name) ) {
                        return false;
                    }
                    return true;
                })
                .map(info => () =>
                    (
                        add_resource({tag_catalog, info, author, Thing, schema__args})
                    )
                    .then(([thing__resource]) =>
                        add_reviewpoints({reviewpoints__new: info.reviewpoints, resource: thing__resource, author, Thing})
                        .then(() => thing__resource)
                    )
                ),
                {
                 // parallelize: resources_info.every(({as_npm_package}) => !!as_npm_package) ? 50 : 1,
                    parallelize: 30,
                    log_progress: 'resources of catalog `'+tag_catalog.name+'` upserted',
                }
            )
        );
    } 
    function add_resource({tag_catalog, info, author, Thing, schema__args}) { 
        const resource_info = {
            type: 'resource',
            author,
            draft: {},
        };

        if( info.as_npm_package ) {
            const github_full_name = info.as_npm_package.github_full_name;
            const npm_package_name = info.as_npm_package.npm_package_name;
            assert_hard(github_full_name && npm_package_name);
            return (
                new Thing(Object.assign({
                    github_full_name,
                    npm_package_name,
                }, resource_info)).draft.save()
            );
        }

        if( info.as_github_repository ) {
            const github_full_name = info.as_github_repository.github_full_name;
            assert_hard(github_full_name);
            /*
            {
                assert_hard(tag_catalog.markdown_list__github_full_name, tag_catalog);
                const tag_gh = tag_catalog.markdown_list__github_full_name;
                assert_hard(is_a_catalog({github_full_name, meta: true})===false);
                assert_hard(is_a_catalog({github_full_name: tag_gh, meta: false})===false || is_a_catalog({github_full_name})===false);
                assert_hard(is_a_catalog({github_full_name: tag_gh})===true || is_a_catalog({github_full_name})===false);
                assert_hard(is_a_catalog({github_full_name: tag_gh, meta: true})===false || is_a_catalog({github_full_name, meta: false})===true, tag_gh+' '+github_full_name);
            }
            */
            return (
                (
                    Promise.resolve(
                        is_a_catalog({github_full_name, Thing, schema__args})
                    )
                )
                .then(it_is => {
                    assert_hard([true, false].includes(it_is));

                    if( ! it_is ) {
                        const title = info.as_github_repository.title;
                        assert_hard(title);
                        return (
                            new Thing(Object.assign({
                                github_full_name,
                                resource_title: title,
                            }, resource_info)).draft.save()
                        );
                    }

                    const name = CATALOGS[info.as_github_repository.github_full_name];
                 // const name = info.as_github_repository.title.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
                    assert_hard(name);
                    assert_hard(tag_name_test(name));

                    return (
                        Thing.database.load.things({
                            type: 'tag',
                            markdown_list__github_full_name: github_full_name,
                        })
                        .then(([thing__tag]) => {
                            if( thing__tag ) {
                                return thing__tag;
                            }
                            return (
                                new Thing({
                                    type: 'tag',
                                    draft: {
                                        markdown_list__github_full_name: github_full_name,
                                        author,
                                        name,
                                    },
                                }).draft.save().then(([thing__tag]) => thing__tag)
                            );
                        })
                        .then(thing__tag => {
                            assert_hard(thing__tag.id);
                            return (
                                new Thing({
                                    type: 'resource',
                                    author,
                                    referred_tag: thing__tag.id,
                                    draft: {},
                                }).draft.save()
                            );
                        })
                    );
                })
            );
        }

        if( info.as_website_url ) {
            const resource_url = info.as_website_url.resource_url;
            const crowded__name = info.as_website_url.title;
            assert_hard(resource_url);
            assert_hard(crowded__name);
            if( info.description ) {
                resource_info.crowded__description = info.description;
            }
            return (
                new Thing(Object.assign({
                    resource_url,
                    crowded__name,
                }, resource_info)).draft.save()
            );
        }


        assert_hard(false);
    } 

    function add_reviewpoints({resource, reviewpoints__new, author, Thing}) { 
        if( ! reviewpoints__new ) {
            return Promise.resolve();
        }
        assert_hard(reviewpoints__new.constructor===Array);
        return (
            Thing.database.load.things({
                type: 'reviewpoint',
                author,
                referred_resource: resource.id,
                is_removed: false,
            })
            .then(reviewpoints__old =>
                Promise.all([
                    ...remvove_old(reviewpoints__old),
                    ...add_current(reviewpoints__old),
                ])
            )
        );

        function remvove_old(reviewpoints__old) {
            const to_update = reviewpoints__old.filter(rp => !is_in(rp, reviewpoints__new));
            to_update
            .forEach(rp => {
                rp.draft.author = author,
                rp.draft.is_removed = true;
            });
            return (
                to_update
                .map(rp => rp.draft.save())
            );
        }

        function add_current(reviewpoints__old) {
            const to_update = reviewpoints__new.filter(rp => !is_in(rp, reviewpoints__old))
            return (
                to_update
                .map(({is_negative, text, explanation}) =>
                    new Thing({
                        type: 'reviewpoint',
                        draft: {
                            referred_resource: resource.id,
                            author,
                            text,
                            explanation,
                            is_negative,
                        },
                    }).draft.save()
                )
            );
        }

        function is_in(rp1, rps) {
            assert_hard(rp1.text);
            assert_hard(rp1.is_negative.constructor===Boolean);
            assert_hard(!rp1.explanation || rp1.explanation.constructor === String);
            assert_hard(rps.every(rp2 => !rp2.explanation || rp2.explanation.constructor === String));
            const it_is = (
                rps.find(rp2 =>
                    rp2.text === rp1.text &&
                    rp2.is_negative === rp1.is_negative &&
                    (!rp2.explanation && !rp1.explanation || rp2.explanation === rp1.explanation)
                ) !== undefined
            );
            return it_is;
        }
    } 

    function recompute_resources({tag_catalog, Thing}) { 
        return (
            Thing.database.management.migrate.recompute_things({
                filter_properties: {
                    type: 'resource',
                    preview: {tags: [tag_catalog.name]},
                },
                schema__args: {
                    cache_expiration_limit: null,
                },
            })
        );
    } 

    function check_for_orphans({tag_catalog, Thing}) { 
        return (
            Thing.database.load.things({
                preview: {tags: [tag_catalog.name]},
            })
            .then(things => {
                const resources = things.filter(t => t.type==='resource');
                const tags = things.filter(t => t.type==='tag');
                assert_hard(tags.length>0);
                tags.forEach(tag => {
                    assert_hard([true, false].includes(tag.is_removed), tag);
                });

                resources.forEach(resource => {
                    const categories = (
                        [
                            ...resource.preview.tags,
                            ...resource.preview.tagreqs.map(tr => tr.req_tag_name),
                        ]
                        .filter(tag_name => tag_name.startsWith(tag_catalog.name+':'))
                        .map(tag_name => {
                            const findings = tags.filter(t => t.name===tag_name);
                            assert_hard(findings.length<=1, tags, tag_name);
                            assert_hard(findings.length===1, tag_name, resource.npm_package_name);
                            return findings[0];
                        })
                        .filter(tag => tag.referred_tag_markdown_list === tag_catalog.id)
                        .filter(tag => tag.is_removed===false)
                    )
                    const no_category = categories.length === 0;
                    const expected_removal = ((MANUAL_TAGGING[tag_catalog.name]||{})[resource.npm_package_name]||{}).op_remove;
                    if( no_category && !expected_removal ) {
                        reporter.log_error({type: 'orphan', resource, tag_catalog});
                    }
                });
            })
        );
    } 

    function check_if_all_resources_are_created({tag_catalog, resources_info, Thing}) { 
        assert_hard(tag_catalog.name);
        return (
            Thing.database.load.things({
                type: 'resource',
                preview: {tags: [tag_catalog.name]},
            })
        )
        .then(things => {
            resources_info.forEach(info => {
                if( info.as_npm_package ) {
                    const github_full_name = info.as_npm_package.github_full_name;
                    const npm_package_name = info.as_npm_package.npm_package_name;
                    assert_hard(
                        things.find(t =>
                            t.type === 'resource'
                            && t.github_full_name === github_full_name
                            // TODO
                            // && t.npm_package_name === npm_package_name
                        ),
                        "resource missing in postgres: `{github_full_name: '"+github_full_name+"', npm_package_name: '"+npm_package_name+"'}`"
                    );
                    return;
                }
                if( info.as_github_repository ) {
                    /* TODO: load tags as well
                    const github_full_name = info.as_github_repository.github_full_name;
                    assert_hard(
                        things.find(t =>
                            t.type==='resource' && t.github_full_name === github_full_name ||
                            t.type==='tag' && t.markdown_list__github_full_name === github_full_name
                        ),
                        "thing missing in postgres: `{github_full_name: '"+github_full_name+"}`"
                    );
                    */
                    return;
                }
                if( info.as_website_url ) {
                    const resource_url = info.as_website_url.resource_url;
                    assert_hard(
                        things.find(t => t.type==='resource' && t.resource_url === resource_url),
                        "resource missing in postgres: `{resource_url: '"+resource_url+"'}`"
                    );
                    return;
                }
                assert_hard(false, JSON.stringify(info, null, 2));
            });
        });
    } 

    function check_if_md_taggings_are_missing({tag_catalog, taggings__md, Thing}) { 
        assert_hard(tag_catalog.name);
        return (
            Thing.database.load.things({
                type: 'resource',
                preview: {tags: [tag_catalog.name]},
            })
        )
        .then(resources => {
            const resources__map = {};
            resources.forEach(r => resources__map[r.id] = r);

            taggings__md
            .forEach(({resource, tag_category}) => {
                resource = resources__map[resource.id];
                const tr = resource.preview.tagreqs.find(tr => tr.req_tag_name===tag_category.name);

                const manual_op = (MANUAL_TAGGING[tag_catalog.name]||{})[resource.npm_package_name]||{};

                const is_missing = (
                    ! resource.preview.tags.includes(tag_category.name) ||
                    ! ( tr===undefined || tr.req_approved===true || tr.req_approved===false && manual_op.op_reject )
                );
                if( is_missing ) {
                    reporter.log_error({type: 'missing_md_taggings', resource, tag_category});
                }
            });
        });
    } 

    function parse_reviewpoints(desc) { 
        const ret = {
            reviewpoints: [],
            description: null
        };

        const DESC = Symbol();
        const RP_TEXT = Symbol();
        const RP_EXPL = Symbol();
        let state = DESC;

        let review_point = null;
        const current_phrase = [];

        desc
        .split(/\s/)
        .forEach(word => {
            if( word === 'Pro:' || word === 'Con:') {
                flush();
                review_point = {
                    is_negative: word === 'Con:',
                };
                state = RP_TEXT;
                return;
            }
            if( state === RP_TEXT && word.endsWith(':') ) {
                current_phrase.push(word.slice(0, -1));
                review_point.text = flush_phrase(current_phrase);
                state = RP_EXPL;
                return;
            }

            current_phrase.push(word);

            return;
        });

        flush();

        assert_hard(current_phrase.length===0);
        assert_hard(review_point===null);
        assert_hard(ret.description!==null);
        assert_hard(ret.reviewpoints.constructor===Array);

        return ret;

        function flush() {
            if( state === DESC ) {
                ret.description = flush_phrase(current_phrase);
            }
            if( state === RP_TEXT ) {
                review_point.text = flush_phrase(current_phrase);
            }
            if( state === RP_EXPL ) {
                review_point.explanation = flush_phrase(current_phrase);
            }
            if( state === RP_TEXT || state === RP_EXPL ) {
                assert_hard(review_point.text!==undefined);
                ret.reviewpoints.push(review_point);
                review_point = null;
            }
        }

        function flush_phrase(arr) {
            assert_hard(arr.constructor===Array);
            const phrase = clean_sentence(arr.join(' '));
            arr.length = 0;
            return phrase;
        }
    } 

    function is_a_catalog({github_full_name, meta=null}) { 
        assert_hard([null, false, true].includes(meta));
        const META_CATALOGS = [
            'brillout-test/programming-libraries',
            'devarchy/frontend-catalogs',
            'brillout-test/websites',
        ];
        return (
            [].concat(
                meta===true ? [] : Object.keys(CATALOGS)
            ).concat(
                meta===false ? [] : META_CATALOGS
            ).includes(
                github_full_name
            )
        );
    } 

    /*
    function is_a_catalog({github_full_name, Thing, schema__args}) { 
        const retrieve_whitelist__promise = retrieve_whitelist({Thing, schema__args});

        is_a_catalog = ({github_full_name, Thing}) => {
            return (
                retrieve_whitelist__promise
                .then(whitelist => {
                    if( whitelist.includes(github_full_name) ) {
                        return true;
                    }
                    return false;
                 // return (
                 //     retrieve_markdown_info({github_full_name, Thing, schema__args})
                 //     .then(({number_of_links, number_of_chars}) => {
                 //         return number_of_links > 12 && ((number_of_links / number_of_chars) > 1/400);
                 //     })
                 // )
                })
            );
        };

        return is_a_catalog({github_full_name, Thing, schema__args});

        function retrieve_whitelist({Thing, schema__args}) { 
            const WHITELIST = [
                'vuejs/awesome-vue',
                'brillout/awesome-vue',
                'brillout/awesome-react-components',
                'brillout/awesome-angular-components',
                'brillout/awesome-redux',
                'brillout/awesome-web-apps',
                'brillout/awesome-frontend-libraries',
                'brillout-test/programming-libraries',
                'devarchy/frontend-catalogs',
                'brillout-test/websites',
            ];

            return (
                github_api.repo.get_readme({
                    full_name: 'sindresorhus/awesome',
                    max_delay: Thing.http_max_delay,
                    markdown_parsed: false,
                    cache__entry_expiration: schema__args.cache_expiration_limit,
                })
                .then(text_markdown => {
                    assert_hard(text_markdown);
                    const categories_info = parse_markdown_catalog(text_markdown, {mode: 'silent'});
                    const awesome_lists = (
                        categories_info
                        .reduce((acc, cur) => acc.concat(cur.resources), [])
                        .map(({as_npm_package={}, as_github_repository={}}) => as_npm_package.github_full_name || as_github_repository.github_full_name)
                        .filter(Boolean)
                    );
                    return awesome_lists.concat(WHITELIST);
                })
            );
        } 

        function retrieve_markdown_info({github_full_name, Thing, schema__args}) { 
            return (
                github_api.repo.get_readme({
                    full_name: github_full_name,
                    max_delay: Thing.http_max_delay,
                    markdown_parsed: false,
                    cache__entry_expiration: schema__args.cache_expiration_limit,
                })
                .then(text_markdown => {
                    if( text_markdown === null ) {
                        return null;
                    }

                    const categories_info = parse_markdown_catalog(text_markdown);

                    return {
                        number_of_links: categories_info.reduce((acc, cur) => acc+cur.resources.length, 0),
                        number_of_chars: text_markdown.length,
                    };
                })
            );
        } 
    } 
    */

    function create_reporter() { 
        const logs = {
            errors: {
                strayed: [],
                missing_md_taggings: [],
                inconsistency: [],
                orphan: [],
                rejection: [],
            },
            info: {
                resource_categories: [],
                resource_move: [],
                resource_addition: [],
                resource_removal: [],
                resource_rejection: [],
                category_new: [],
                category_removed: [],
            },
        };

        const report_obj = {
            log_error,
            log_info,
            report_errors,
            report_info,
        };

        return report_obj;

        function log_error(args) {
            const {type} = args;
            logs.errors[type].push(args);
        }

        function log_info(args) {
            const {type} = args;
            logs.info[type].push(args);
        }

        function report_info() {
            if( logs.info.category_new ) {
                print('\nCategories preserved/added:');
                logs.info.category_new
                .forEach(({tag_category, time_before_save}) => {
                    const updated_at = new Date(tag_category.updated_at);
                    const created_at = new Date(tag_category.created_at);

                    let print_text;

                    if( created_at >= time_before_save) {
                        print_text = '`'+tag_category.title+'` - New';
                    } else {
                        print_text = '`'+tag_category.title+'` - Preserved';
                        if( updated_at >= time_before_save ) {
                            const title_has_changed = tag_category.history.filter(h => h.created_at>=time_before_save).reverse().find(h => h.title);
                            if( title_has_changed ) {
                                const title_change_event = tag_category.history.filter(h => h.created_at<time_before_save).reverse().find(h => h.title);
                                assert_hard(title_change_event);
                                if( title_change_event ) {
                                    print_text += ' - Renamed from `'+title_change_event.title+'`';
                                }
                            }
                        }
                    }

                    print(print_text);
                });
                logs.info.category_new.length = 0;
            };

            if( logs.info.category_removed.length ) {
                print('\nCategories removed:');
                logs.info.category_removed.forEach(({tag_category}) => {
                    print('`'+tag_category.title+'`');
                });
                logs.info.category_removed.length = 0;
            }

            if( logs.info.resource_categories.length ) {
                print('\nResource categories before -> after translation:');
                logs.info.resource_categories.forEach(({npm_package_name, r_categories__old, r_categories__new, manual_op}) => {
                    print(''+npm_package_name+': '+JSON.stringify(r_categories__old)+' -> '+JSON.stringify(r_categories__new)+', manual: '+manual_op);
                });
                logs.info.resource_categories.length = 0;
            }

            if( logs.info.resource_removal.length ) {
                print('\nResource removals:');
                logs.info.resource_removal.forEach(({resource, tag_category}) => {
                    print('`'+resource.github_full_name+'` from `'+tag_category.name+'`');
                });
                logs.info.resource_removal.length = 0;
            }

            if( logs.info.resource_addition.length ) {
                print('\nResource aditions/approvals:');
                logs.info.resource_addition.forEach(({resource, tag_category}) => {
                    print('`'+resource.github_full_name+'` to `'+tag_category.name+'`');
                });
                logs.info.resource_addition.length = 0;
            }

            if( logs.info.resource_rejection.length ) {
                print('\nResource rejections:');
                logs.info.resource_rejection.forEach(({resource, tag_category}) => {
                    print('`'+resource.github_full_name+'` from `'+tag_category.name+'`');
                });
                logs.info.resource_rejection.length = 0;
            }

            if( logs.info.resource_move.length ) {
                print('\nResource moves:');
                logs.info.resource_move.forEach(({resource, tag_category__old, tag_category__new}) => {
                    print('`'+resource.github_full_name+'` from `'+tag_category__old.name+'` to `'+tag_category__new.name+'`');
                });
                logs.info.resource_move.length = 0;
            }

            function print(str) { return console.log(chalk.yellow(str)) }
        }

        function report_errors() {
            if( logs.errors.strayed.length > 0 ) {
                print('\nStraied resources (resources that should be removed from markdown file);');
                logs.errors.strayed.forEach(({resource}) => {
                    print(resource.npm_package_name);
                });
                logs.errors.strayed.length = 0;
            }

            if( logs.errors.rejection.length > 0 ) {
                print('\nUnilateral rejections (resources not present in markdown but approved on devarchy.com DB);');
                logs.errors.rejection.forEach(({resource, tag_category}) => {
                    print([
                        resource.npm_package_name,
                        '(`resource.preview=='+JSON.stringify(resource.preview)+'`,',
                        'category in markdown: `'+tag_category.name+'`)',
                    ].join(' '));
                });
                logs.errors.rejection.length = 0;
            }

            if( logs.errors.missing_md_taggings.length > 0 ) {
                print('\nMarkdown taggings missing;');
                logs.errors.missing_md_taggings.forEach(({resource, tag_category}) => {
                    print([
                        resource.npm_package_name,
                        '(`resource.preview=='+JSON.stringify(resource.preview)+'`,',
                        'category in markdown: `'+tag_category.name+'`)',
                    ].join(' '));
                });
                logs.errors.missing_md_taggings.length = 0;
            }

            if( logs.errors.inconsistency.length > 0 ) {
                print('\nInconsistent approval (markdown contradicts devarchy.com DB);');
                logs.errors
                .inconsistency
                .forEach(({resource, tag_category}) => {
                    print([
                        resource.npm_package_name,
                        '(`resource.preview=='+JSON.stringify(resource.preview)+'`,',
                        'category in markdown: `'+tag_category.name+'`)',
                    ].join(' '));
                });
                logs.errors.inconsistency.length = 0;
            }

            if( logs.errors.orphan.length > 0 ) {
                print('\nOrphans (resources that should be put in graveyard/crib);');
                logs.errors
                .orphan
                .forEach(({resource, tag_category}) => {
                    print([
                        resource.npm_package_name,
                        '[`preview.tags=='+JSON.stringify(resource.preview.tags)+'`,',
                        '`preview.tagreqs=='+JSON.stringify(resource.preview.tagreqs)+'`]',
                    ].join(' '));
                });
                logs.errors.orphan.length = 0;
            }

            return;

            function print(str) { return console.log(chalk.red(str)) }
        }
    } 

    function assign_array(arr1, arr2, key_retriever) { 
        const map = {};
        [arr1, arr2].forEach(arr => {
            arr.forEach(el => {
                const key = key_retriever(el);
                assert_hard(key);
                map[key] = el;
            });
        });
        return Object.values(map);
    } 

    function req_approved_value(values, resource) { 
        const POSSIBLE_VALUES = [true, false, null, undefined];
        if( POSSIBLE_VALUES.includes(values) ) {
            values = [values];
        }
        assert_hard(values.every(v => POSSIBLE_VALUES.includes(v)), values);
        assert_hard(resource, resource, values);

        return input => {
            assert_hard(input.constructor===String || input.type==='tag' && input.referred_tag_markdown_list, input);
            const category_name = (
                input.type==='tag' ? (
                    input.name
                ) : (
                    input
                )
            );
            assert_hard(category_name.constructor===String, input);

            const trS = (
                resource.preview.tagreqs.filter(tr => {
                    const rq_tag_name = tr.req_tag_name;
                    assert_hard(rq_tag_name, resource);
                    return (
                        rq_tag_name===category_name
                    );
                })
            );
            assert_hard(trS.length<=1, resource);

            const tr = trS[0];

            if( ! tr ) {
                return values.includes(undefined);
            }

            const rq_approved = tr.req_approved;
            assert_hard([true, false, null].includes(rq_approved), resource);

            return values.includes(rq_approved);
        };
    } 


} 

function tag_rename__recompute_resources(thing_self, {Thing, transaction, schema__args}) { 
    if( ! schema__args.recompute_resources_upon_rename ) {
        return null;
    }

    const last_change = thing_self.history.slice(-1)[0];
    if( thing_self.history.length===1 || !last_change.name ) {
        return null;
    }

    if( ! ('cache_expiration_limit' in schema__args) ) {
        schema__args.cache_expiration_limit = null;
    }

    const previous_name = (thing_self.history.slice(0, -1).reverse().find(({name}) => name)||{}).name;
    assert_hard(previous_name);

    return () => (
        Thing.database.load.things({
            preview: {tags: [previous_name]}
        })
        .then(things =>
            Promise_serial(
                (
                    things
                    .map(t => () =>
                        t.recompute({
                            dont_cascade_saving: true,
                            dont_apply_side_effects: true,
                            schema__args,
                            transaction,
                        })
                    )
                ),
                {
                    parallelize: 30,
                    log_progress: "recomputed things' preview.tags of `"+thing_self.name+'` (because of tag renaming)',
                }
            )
        )
    );
} 

function handle_api_problems({data_promise, data_current, Thing, error_on_empty_response, data_constructor, is_removed, schema__args}) { 
    assert_hard(data_constructor);
    assert_hard([String, Object].includes(data_constructor));
//  assert_soft(data_current===undefined || data_current!==null && data_current.constructor===data_constructor, data_current);

    return (
        data_promise
        .then(data_new => {
            assert_soft(data_new===null || data_new!==undefined && data_new.constructor===data_constructor);

            if( [null, undefined].includes(data_new) ) {
                // TRICK: `data_current === undefined` <=> this function is being called for a database insertion (and not a database update)
                const err_obj = new Thing.ValidationError(error_on_empty_response);
                const IS_INSERTION = [null, undefined].includes(data_current);

                if( schema__args.is_from_api ) {
                    throw err_obj;
                }

                if( ! IS_INSERTION ) {
                    if( data_current.constructor===Object ) {
                        const data_old = Object.assign({}, data_current, {_is_deleted: true});
                        delete data_old._could_not_connect;
                        return data_old;
                    }
                    if( data_current.constructor===String ) {
                        global['co'+'nsole'].warn('Warning: '+error_on_empty_response);
                        return data_current;
                    }
                    assert_soft(false);
                }
                if( IS_INSERTION && !is_removed && error_on_empty_response ) {
                    throw err_obj;
                }

                assert_soft(is_removed);
            }

            return data_new;
        })
        .catch(err => {
            if( err.response_connection_error ) {
                if( ![null, undefined].includes(data_current) ) {
                    if( data_current.constructor===Object ) {
                        return Object.assign({}, data_current, {_could_not_connect: true});
                    }
                    if( data_current.constructor===String ) {
                        return data_current;
                    }
                    assert_soft(false);
                }
                if( Thing.dont_throw_on_connection_errors ) {
                    if( data_constructor === String ) {
                        return '';
                    }
                    if( data_constructor === Object ) {
                        return {};
                    }
                    assert_soft(false);
                }
            }
            throw err;
        })
    );
} 
