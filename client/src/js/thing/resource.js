import assert from 'assertion-soft';
import assert_soft from 'assertion-soft';
import validator from 'validator';
import user_tracker from '../user_tracker';
import {is_npm_package_name_valid} from '../util/npm_package_name_validation';
import normalize_url from '../util/normalize_url';
import pretty_print from '../util/pretty_print';
import text_search from '../util/text_search';
import clean_sentence from 'clean-sentence'
import CommentableMixin from './mixins/commentable';
import VotableMixin from './mixins/votable';
import Thing from './thing.js';
import Tag from './tag.js';
import Promise from 'bluebird';
Promise.longStackTraces();

//const cache__resources = {};

class Resource extends VotableMixin(CommentableMixin(Thing), {author_can_selfvote: true}) {
    constructor(...args) {
        super(...args);
    }

    get resource_name() { 
        if( this.resource_is_website ) {
            return (
                this.crowded__name ||
                (this.html_info||{}).html_title ||
                this.resource_url_normalized ||
                null
            );
        }
        if( this.resource_is_git_repo ) {
            return (
                this.npm_package_name ||
                this.resource_title ||
                this.github_full_name
            );
        }
        if( this.resource_is_list ) {
            const res_tag = Tag.get_by_id(this.referred_tag);
            assert_soft(res_tag);
            /*
            if( res_tag ) {
                return res_tag.display_options.tag_title;
            }
            //*/
            return (
                (this.preview_tag||{}).name
            );
        }
        assert_soft(false, this);
    } 

    get resource_desc() { 
        let desc = (() => {
            if( this.resource_is_website ) {
                return (
                    this.crowded__description ||
                    (this.html_info||{}).html_description ||
                    'no description found'
                );
            }
            if( this.resource_is_git_repo ) {
                return (
                    (this.github_info||{}).description ||
                    (this.npm_info||{}).description ||
                    'no description found'
                );
            }
            if( this.resource_is_list ) {
                const res_tag = Tag.get_by_id(this.referred_tag);
                assert_soft(res_tag);
                if( res_tag ) {
                    return res_tag.display_options.tag_description__without_number;
                }
                return (
                    (this.github_info||{}).description
                )
            }
            assert_soft(false);
        })();
        assert_soft(desc, desc, this.resource_name);
        desc = clean_sentence(desc||'', {remove_emojis: true, remove_urls: true, remove_text_emojis: false});
        assert_soft(desc, desc, this.resource_name);
        return desc;
    } 

    get resource_is_website() { 
        return (
            !!this.resource_url ||
            !!this.resource_url_normalized
        );
    } 

    get resource_is_git_repo() { 
        return (
            !!this.github_full_name
        );
    } 

    get resource_is_list() { 
        return (
            !!this.referred_tag
        );
    } 

    get show_description() { 
        assert_soft([null, undefined, false, true].includes(this.crowded__show_description), this.crowded__show_description);
        if( [false,true].includes(this.crowded__show_description) ) {
            return this.crowded__show_description;
        }
        if( this.github_full_name ) {
            return true;
        }
        if( (this.preview.reviewpoints||[]).length > 0 ) {
            return false;
        }
        return true;
    } 

    get resource_desc_line() { 
        const desc = this.show_description ? this.resource_desc : '';

        const SPACER = ' \u00a0 ';

        const rps = (() => {
            const MINUS = '\u2013';
         // const MINUS = '\u2212';
            const PLUS = '+';

            assert_soft((this.preview.reviewpoints||0).constructor === Array);
            return (
                (this.preview.reviewpoints||[])
                .map(({text, is_negative}) => (is_negative?MINUS:PLUS)+' '+text)
                .join(SPACER)
            );

        })();

        if( ! rps ) {
            return desc;
        }
        if( ! desc ) {
            return '\u00a0 '+rps;
        }
        return desc + SPACER + rps;
    } 

    get published_at() { 
        let date_str = (() => {
            if( this.github_info ) {
                const date_str = this.github_info.created_at;
                assert_soft(date_str);
                return date_str;
            }
            return (
                this.crowded__published_at ||
                (this.html_info||{}).html_published_at ||
                (this.html_info||{}).html_created_at ||
                null
            );
        })();
        assert_soft(date_str===null || date_str);
        if( !date_str ) {
            return null;
        }
        date_str = new Date(date_str);
        assert_soft(date_str != "Invalid Date");
        if( date_str == "Invalid Date" ) {
            return null;
        }
        return date_str;
    } 

    get number_of_points() { 
        if( this.github_full_name || this.referred_tag ) {
            const stars = (this.github_info||{}).stargazers_count;
            assert_soft(Number.isInteger(stars));
            assert_soft(stars>=0);
            if( (stars||{}).constructor === Number ) {
                return stars;
            }
        }
        const upvotes = this.preview.number_of_upvotes;
        assert_soft(Number.isInteger(upvotes));
        assert_soft(upvotes>=0);
        if( (upvotes||{}).constructor===Number ) {
            return upvotes;
        }
        return 0;
    } 

    is_tagged_with(tag) { 
        assert((tag||0).constructor === Tag);

        if( this.preview.tags.includes(tag.name) ) {
            return true;
        }
    } 

    get_a_category(tag__catalog) { 
        assert_soft(tag__catalog.is_catalog);

        {
            const req = this.get_request_info(tag__catalog.id);
            if( req ) {
                assert(req.tag__category.is_category);
                return req.tag__category;
            }
        }

        {
            const tag_category = (
                this.get_all_categories(tag__catalog)[0]
            );
            if( tag_category ) {
                return tag_category;
            }
        }

        assert_soft(false, "orphaned resource `"+this.resource_name+"`; "+JSON.stringify(this.preview));
        return null;
    } 

    get_all_categories(tag_catalog) { 
        assert_soft(tag_catalog.is_catalog);

        return (
            this.preview.tags
            .map(tag_name => Tag.get_by_name(tag_name, {can_be_null: true}))
            .filter(Boolean)
            .filter(tag => tag.is_category)
            .filter(tag => !tag.is_removed)
            .filter(tag => tag.referred_tag_markdown_list===tag_catalog.id)
        );
    } 

    get_request_info(tag__markdown_list__id) { 
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

            assert_soft(req_date || req_date===null, this.preview.tagreqs);
            return {req_date, tag__category};
        }
        return null;
    } 

    get resource_human_id() { 
        return (
            Thing.generate_human_id(this.resource_name)
        );
    } 

    get_missing_words(full_text_search_value, {per_text}={}) { 
        return (
            text_search.get_missing_words({
                full_text_search_value,
                texts: [
                    this.resource_name,
                    this.resource_desc,
                ],
                per_text,
            })
        );
    } 

    get insight() { 
        const all = Thing.things.all;
        const related_things = all.filter(t => t.referred_thing===this.id || t.referred_resource===this.id);
        const taggedS = related_things.filter(t => t.type==='tagged');
        if( ! assert_soft(taggedS.length>0, 'missing information; call me once all related things are loaded') ) return;

        const info = {};

        related_things
        .forEach(t => {
            const overloaded_idS = {};
            [
                'author',
                'referred_resource',
                'referred_tag',
                'referred_thing',
            ].forEach(ref_attr => {
                const ref_id = t[ref_attr];
                if( ref_id ) {
                    overloaded_idS[ref_attr] = (
                        filter_important(
                            Thing.get_by_id(ref_id),
                            {minimal: true}
                        )
                    );
                }
                return ref_id;
            });
            const t__info = (
                Object.assign(
                    {},
                    filter_important(t),
                    overloaded_idS
                )
            );
            info[t.type] = info[t.type] || [];
            info[t.type].push(t__info);
        });

        return info;

        function filter_important(thing, {minimal}={}) {
            const important_info = {};
         // important_info.type = thing.type;
            if( important_info.is_removed ) {
                important_info.is_removed = important_info.is_removed;
            }
            if( thing.type==='resource' ) {
                important_info.npm_package_name = thing.npm_package_name;
                if( !minimal ) {
                    important_info.computed_at = (
                        pretty_print.age(thing.computed_at, {verbose: true})
                    );
                }
            }
            if( thing.type==='genericvote' ) {
                if( important_info.votetype!=='upvote' ) {
                    important_info.votetype = important_info.votetype;
                }
                if( important_info.is_negative ) {
                    important_info.is_negative = important_info.is_negative;
                }
            }
            if( thing.type==='user' ) {
                important_info.github_login = thing.github_login;
            }
            if( thing.type==='tag' ) {
                if( thing.is_category ) {
                    important_info.category__title = thing.category__title;
                }
                if( thing.is_catalog ) {
                    important_info.name = thing.name;
                }
            }
            if( minimal && Object.keys(important_info).length===1 ) {
             // const single_value = Object.entries(important_info).filter(([key]) => key!=='type')[0][1];
                const single_value = Object.values(important_info)[0];
                return single_value;
            }
            important_info.created_at = (
                pretty_print.age(thing.created_at, {verbose: true})
            );
            return important_info;
        }
    } 

    static retrieve_view ({resource_id}) { 
        assert(resource_id);
        return Thing.load.view({things: [{id: resource_id}], show_removed_things: true});
    } 

    static list_things ({age_min = 0, age_max = Infinity, age_missing = false, tags = [], order, list}={}) { 

        assert_soft(age_missing===false || age_min===0 && age_max === Infinity);

        return super.list_things({
            order,
            list,
            filter_function: resources => {
                if( age_missing ) {
                    resources = resources.filter(resource => resource.published_at === null);
                }
                if( age_min !== 0 || age_max !== Infinity ) {
                    resources = resources.filter( resource => {
                        const published_at = resource.published_at;
                        if( published_at === null ) {
                            return false;
                        }
                        const ONE_DAY = 24*60*60*1000;
                        const TODAY = new Date();
                        const limit_upper = TODAY - age_min*ONE_DAY;
                        const limit_lower = TODAY - age_max*ONE_DAY;
                        return limit_lower <= published_at && published_at <= limit_upper;
                    });
                }

                if( tags.length !== 0 ) {
                    assert(tags.every(tag => tag && tag.constructor === Tag));
                    resources = (
                        resources.filter(thing__resource =>
                            tags.every(tag => thing__resource.is_tagged_with(tag))
                        )
                    );
                }

                return resources;
            },
        });

    } 

    /*
    static retrieve_things__by_tag({tag_name}) { 
        assert(tag_name);
        return super.retrieve_things({preview: {tags: [tag_name]}});
    } 
    */

    static order({newest, latest_requests}) { 
        if( latest_requests ) {
            return {
                sort_function: (thing1, thing2) => new Date(thing2.created_at) - new Date(thing1.created_at),
            };
            // equivalent but less efficient:
            // return ['created_at',];
        }
        if( newest ) {
            return {
                sort_function: (thing1, thing2) => {
                    return (
                        thing2.published_at - thing1.published_at ||
                        thing2.number_of_points - thing1.number_of_points ||
                        0
                    );
                }
            };
            // equivalent but less efficient:
            // return ['published_at', 'number_of_points', ];
        }
        return {
            sort_function: (thing1, thing2) => {
                return (
                    thing2.number_of_points - thing1.number_of_points ||
                    thing2.published_at - thing1.published_at ||
                    0
                );
            }
        };
        // equivalent but less efficient:
        // return ['number_of_points', 'published_at', ];
    } 

    static add_to_platform({resource_info: {github_full_name, npm_package_name, resource_url}, is_npm_entry, tags=null}) { 
        assert( tags===null || tags.every(tag => tag.constructor === Tag) );
        assert( Thing.things.logged_user.id );

        const validation_errors = (() => { 
            let validation_errors = null;
            if( is_npm_entry ) {
                if( ! github_full_name ) {
                    validation_errors = validation_errors || {};
                    validation_errors.github_full_name = validation_errors.github_full_name || {};
                    validation_errors.github_full_name.is_missing = true;
                }
                else if( github_full_name.split('/').length !== 2 ) {
                    validation_errors = validation_errors || {};
                    validation_errors.github_full_name = validation_errors.github_full_name || {};
                    validation_errors.github_full_name.is_malformatted = true;
                }
                if( ! npm_package_name ) {
                    validation_errors = validation_errors || {};
                    validation_errors.npm_package_name = validation_errors.npm_package_name || {};
                    validation_errors.npm_package_name.is_missing = true;
                }
                else if( ! is_npm_package_name_valid(npm_package_name) ) {
                    validation_errors = validation_errors || {};
                    validation_errors.npm_package_name = validation_errors.npm_package_name || {};
                    validation_errors.npm_package_name.is_malformatted = true;
                }
            }
            else {
                if( ! resource_url ) {
                    validation_errors = validation_errors || {};
                    validation_errors.resource_url = validation_errors.resource_url || {};
                    validation_errors.resource_url.is_missing = true;
                }
            }

            return validation_errors;
        })(); 

        if( validation_errors ) {
            const err = new Error('Validation Error(s)');
            err.validation_errors = validation_errors;
            return Promise.reject(err);
        }

        const thing_info = {
            type: 'resource',
            author: Thing.things.logged_user.id,
        };

        if( is_npm_entry ) {
            Object.assign(thing_info, {
                github_full_name,
                npm_package_name,
            });
        }
        else {
            Object.assign(thing_info, {
                resource_url,
            });
        }

        return (
            (
                new Thing(thing_info).draft.save()
            )
            .then(resp => {
                assert(resp.constructor===Object);
                assert(resp.things_matched);
                const resource = resp.things_matched[0];
                assert(resource);
                assert(resource.constructor === Resource);
                return resource;
            })
        );
    } 

    alter_categories({tag_catalog, tag_category, categories_to_remove}) {
        if( ! assert_soft((tag_category||{}).is_category) ) return;
        if( ! assert_soft((tag_catalog||{}).is_catalog) ) return;

        const author = Thing.things.logged_user.id;

        const referred_resource = this.id;

        return (
            Promise.all([
                (() => {
                    const referred_tag = tag_category.id;
                    if( ! assert_soft(referred_tag) ) return;

                    const request_date = (() => {
                        const current_request = this.get_request_info(tag_category.referred_tag_markdown_list);
                        return (current_request||{}).req_date || new Date();
                    })();

                    return (
                        new Thing({
                            type: 'tagged',
                            referred_resource,
                            referred_tag,
                            is_removed: false,
                            author,
                            request_date,
                        }).draft.save()
                    );
                })(),
                ...categories_to_remove.map(tc => {
                    if( ! assert_soft((tc||{}).is_category) ) return;
                    const referred_tag = tc.id;
                    if( ! assert_soft(referred_tag) ) return;
                    return (
                        new Thing({
                            type: 'tagged',
                            referred_resource,
                            referred_tag,
                            is_removed: true,
                            author,
                        }).draft.save()
                    );
                })
            ])
        );
    }

    static add_to_markdown_list({resource_info: {github_full_name, npm_package_name, resource_url}, is_npm_entry, tag_catalog, tag_category}) { 
        if( ! tag_category ) {
            return Promise.reject(new Error('Choose a category to add the resource to'));
        }
        assert( tag_catalog.is_catalog );
        assert( tag_category.is_category );
        assert( tag_category.id );
        assert( tag_category.referred_tag_markdown_list === tag_catalog.id );

        return (
            this.add_to_platform({resource_info: {github_full_name, npm_package_name, resource_url} , is_npm_entry})
        )
        .then(resource => {
            assert( resource && resource.constructor === Resource );

            const author = Thing.things.logged_user.id;

            const current_request = resource.get_request_info(tag_category.referred_tag_markdown_list);

            const current_category_id = ((current_request||{}).tag_category||{}).id;
            assert_soft(current_request===null || current_category_id);

            const request_date = (() => {
                // If the resource is already in the category then it's not a request.
                // Adding a resource to a category it's already in is a way to update its `npm_package_name` or `github_full_name`.
                if( resource.is_tagged_with(tag_category) ) {
                    return null;
                }
                return (current_request||{}).req_date || new Date();
            })();

            const referred_resource = resource.id;
            const referred_tag = tag_category.id;

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
        .then(() => {
            user_tracker.log_event({
                category: 'entry added',
                action: tag_catalog.name,
                additional_info: {
                    github_full_name,
                    npm_package_name,
                    in_category: tag_category.category__title,
                },
            });
        });
    } 

    static get result_fields() { 
        return super.result_fields.concat([
            'github_full_name',
            'github_info.full_name',
            'github_info.description',
            'github_info.created_at',
            'github_info.pushed_at',
            'github_info.homepage',
            'github_info.stargazers_count',
            'npm_package_name',
            'npm_info.description',
            'html_info.html_title',
            'html_info.html_description',
            'html_info.html_created_at',
            'html_info.html_published_at',
            'resource_title',
            'crowded__name',
            'crowded__description',
            'crowded__show_description',
            'crowded__published_at',
            'resource_url',
            'resource_url_normalized',
            'referred_tag',
            'created_at',
            'preview',
            'preview_tag',
        ]);
    } 

    static get_resource_by_name({tag_name, resource_human_id}) { 
        assert_soft(tag_name);
        assert_soft(resource_human_id);
        const tag = Tag.get_by_name(tag_name, {can_be_null: true});
        if( !tag ) {
            return {};
        }
        const resource = tag.get_resource_by_human_id({resource_human_id});
        return {resource, tag};
    } 
};

Resource.type = 'resource'; // UglifyJS2 mangles class name
export default Resource;


