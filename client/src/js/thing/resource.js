import assert from 'assert';
import validator from 'validator';
import {is_npm_package_name_valid} from '../util/npm';
import clean_sentence from 'clean-sentence'
import mixin from './mixin/mixin.decorator.js';
import CommentableMixin from './mixin/commentable';
import VotableMixin from './mixin/votable';
import Thing from './thing.js';
import Tag from './tag.js';
import Promise from 'bluebird';
Promise.longStackTraces();

const map__github_full_name = {};

@mixin(CommentableMixin)
@mixin(VotableMixin)
class Resource extends Thing {
    constructor(...args) {
        super(...args);
        assert( this.github_full_name );
        assert( !this.id || this.github_info );
        assert( !this.id || this.github_info.created_at );
        map__github_full_name[this.github_full_name.toLowerCase()] = this;
    }

    get description() { 
        let desc = (this.npm_info||{}).description || this.github_info.description;
        desc = clean_sentence(desc||'', {remove_emojis: true, remove_urls: true});
        return desc;
    } 

    add_tag (tag) { 
        return (
            set_tagged_removed_prop(this, tag, false)
        );
    } 

    remove_tag (tag) { 
        return (
            set_tagged_removed_prop(this, tag, true)
        );
    } 

    get tags_all() { 
        const tags =
            this.preview.tags
            .map(tagname => Tag.get_by_name(tagname));

        assert(tags.every(t => !!t));
        assert(tags.every(t => !t.is_markdown_category));
        return tags;
    } 

    get tagrequests() { 
        return (
            this.preview.tagreqs
            .map(({tagname, category}) => {
                const tag__markdown_list = Tag.get_by_name(tagname);
                assert(tag__markdown_list, 'could not find a Thing.tag instance for `'+tagname+'`');
                assert(tag__markdown_list.is_markdown_list);
                const tag__category_id = Tag.category__get_global_id(category, tag__markdown_list.id);
                const tag__category = Tag.get_by_name(tag__category_id);
                assert(tag__category);
                return tag__category;
            })
            .filter(tag => {
                assert(tag);
                assert(tag.is_markdown_category);
                return !tag.tagged_resources.find(({github_full_name}) => this.github_full_name === github_full_name);
            })
        );
    } 

    get_category_request(tag) { 
        assert(tag.is_markdown_list);
        const categories = this.preview.tagreqs.filter(({tagname}) => tagname === tag.name);
        assert(categories.length>0, tag.name+' not found in '+JSON.stringify(this.preview.tagreqs, null, 2));
        assert(categories.length===1);
        const category_id = categories[0].category;
        const category_id_global = Tag.category__get_global_id(category_id, tag.id);
        assert(category_id);
        const category = Tag.get_by_name(category_id_global);
        assert(category, category_id_global+' not found');
        return category;
    } 

    is_tagged_with(tag, options) { 
        assert((tag||0).constructor === Tag);

        for(const fct of [is_tagged_through_request, is_tagged_through_tagged_thing, is_tagged_through_markdown_list]) {
            const val = fct.call(this, options);
            if( val !== null) {
                return val;
            }
        }

        return false;

        function is_tagged_through_request({awaiting_approval}={}) {
            if( ! tag.is_markdown_category ) {
                return null;
            }
            if( ! awaiting_approval ) {
                return null;
            }
            assert(['INCLUDE', 'ONLY', 'EXCLUDE'].includes(awaiting_approval));
            const is_awaiting_approval = this.is_awaiting_approval_for(tag);
            if( awaiting_approval === 'ONLY' ) {
                return is_awaiting_approval;
            }
            if( awaiting_approval === 'INCLUDE' && is_awaiting_approval ) {
                return true;
            }
            if( awaiting_approval === 'EXCLUDE' && is_awaiting_approval ) {
                return false;
            }
            assert(false);
        }

        function is_tagged_through_tagged_thing() {
            if( this.preview.tags.includes(tag.name) ) {
                return true;
            }
            return null;
        }

        function is_tagged_through_markdown_list() {
            if( !tag.tagged_resources ) {
                return null;
            }

            const is_in =
                tag.tagged_resources.some(({github_full_name, npm_package_name}) =>
                    matches_key(this, {github_full_name, npm_package_name})
                );
            if( is_in ) {
                return true;
            } else {
                return null;
            }

            function matches_key(resource, {github_full_name, npm_package_name}) {
                assert(github_full_name);
                assert(npm_package_name);
                assert(resource.github_full_name);
                assert(resource.npm_package_name);
                const github_full_name__match = resource.github_full_name.toLowerCase() === github_full_name.toLowerCase();
                const npm_package_name__match = resource.npm_package_name.toLowerCase() === npm_package_name.toLowerCase();
                const partial_match = github_full_name__match || npm_package_name__match;
                const complete_match = github_full_name__match && npm_package_name__match;
                return complete_match;
                /*
                assert(
                    ! partial_match || complete_match,
                    [
                        resource.github_full_name.toLowerCase(),
                        '!==',
                        github_full_name.toLowerCase(),
                        '||',
                        resource.npm_package_name.toLowerCase(),
                        '!==',
                        npm_package_name.toLowerCase(),
                    ].join(' ')
                );
                return partial_match;
                */
            }
        }

    } 

    is_awaiting_approval_for(tag__markdown_category) { 
        assert(tag__markdown_category);
        assert(tag__markdown_category.constructor === Tag);
        assert(tag__markdown_category.is_markdown_category);
        return this.preview.tagreqs.includes(tag__markdown_category.name);
    } 

    get logged_user_is_owner() { 
        const repo = this.github_full_name.split('/');
        assert(repo.length===2);
        const repo_owner = repo[0];
        if( ! Thing.things.logged_user ) {
            return false;
        }
        return Thing.things.logged_user.github_login.toLowerCase() === repo_owner.toLowerCase();
    } 

    static retrieve_view (github_full_name) { 
        assert(github_full_name);
        return Thing.load.view([{
            type: 'resource',
            github_full_name,
        }]);
    } 

    static get_by_github_full_name (github_full_name) { 
        assert(github_full_name);
        return map__github_full_name[github_full_name.toLowerCase()];
    } 

    static retrieve_by_github_full_name (github_full_name) { 
        assert(github_full_name);
        return super.retrieve_by_props({github_full_name});
    } 

    static list_things ({age_min = 0, age_max = Infinity, tags = [], order, list, awaiting_approval}={}) { 

        return super.list_things({
            order,
            list,
            filter_function: resources => {
                if( age_min !== 0 || age_max !== Infinity ) {
                    resources = resources.filter( resource => {
                        const ONE_DAY = 24*60*60*1000;
                        const TODAY = new Date();
                        const created_at = new Date(resource.github_info.created_at);
                        const limit_upper = TODAY - age_min*ONE_DAY;
                        const limit_lower = TODAY - age_max*ONE_DAY;
                        return limit_lower <= created_at && created_at <= limit_upper;
                    });
                }

                if( tags.length !== 0 ) {
                    assert(tags.every(tag => tag && tag.constructor === Tag));

                    resources = resources.filter(thing__resource =>
                        tags.every(tag => thing__resource.is_tagged_with(tag, {awaiting_approval}))
                    );
                }

                return resources;
            },
        });

    } 

    static retrieve_things__by_tag({tag_name}) { 
        assert(tag_name);
        return super.retrieve_things({preview: {tags: [tag_name]}});
    } 

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
                        new Date((thing2.github_info||{}).created_at) - new Date((thing1.github_info||{}).created_at) ||
                        (thing2.github_info||{}).stargazers_count - (thing1.github_info||{}).stargazers_count ||
                        0
                    );
                }
            };
            // equivalent but less efficient:
            // return ['github_info.created_at', 'github_info.stargazers_count', ];
        }
        return {
            sort_function: (thing1, thing2) => {
                return (
                    (thing2.github_info||{}).stargazers_count - (thing1.github_info||{}).stargazers_count ||
                    new Date((thing2.github_info||{}).created_at) - new Date((thing1.github_info||{}).created_at) ||
                    0
                );
            }
        };
        // equivalent but less efficient:
        // return ['github_info.stargazers_count', 'github_info.created_at', ];
    } 

    static add_to_markdown_list({github_full_name, npm_package_name, tag__markdown_list, tag__category}) { 
        if( ! tag__category ) {
            return Promise.reject(new Error('Choose a category to add the resource to'));
        }
        assert( tag__markdown_list && tag__markdown_list.is_markdown_list );
        assert( tag__category.is_markdown_category );
        assert( tag__category.id && tag__category.id === tag__category.name );

        return (
            add_to_platform({github_full_name, npm_package_name})
        )
        .then(infos => {
            assert( infos );
            assert( infos.resource && infos.resource.constructor === Resource );
            return Promise.all([
                new Thing({
                    type: 'tagged',
                    referred_resource: infos.resource.id,
                    referred_tag: tag__markdown_list.id,
                    tagrequest: tag__category.category_id,
                    removed: false,
                    draft: {
                        author: Thing.things.logged_user.id,
                    },
                }).draft.save(),
                new Thing({
                    type: 'genericvote',
                    vote_type: 'upvote',
                    referred_thing: infos.resource.id,
                    author: Thing.things.logged_user.id,
                    draft: {},
                }).draft.save(),
            ]);
        })
        .then(() => {});
    } 

    static get result_fields() { 
        return super.result_fields.concat([
            'created_at',
            'github_full_name',
            'npm_package_name',
            'npm_info.description',
            'preview',
            'github_info.full_name',
            'github_info.description',
            'github_info.created_at',
            'github_info.pushed_at',
            'github_info.homepage',
            'github_info.stargazers_count',
        ]);
    } 
};

Resource.type = 'resource'; // UglifyJS2 mangles class name
export default Resource;


function set_tagged_removed_prop(resource, tag, value) { 
    assert(tag && tag.constructor === Tag && tag.id && validator.isUUID(tag.id));
    assert(resource && resource.constructor === Resource && resource.id && validator.isUUID(resource.id));
    assert((Thing.things.logged_user||{}).id);

    return new Thing({
        type: 'tagged',
        referred_tag: tag.id,
        referred_resource: resource.id,
        removed: value,
        author: Thing.things.logged_user.id,
        draft: {},
    }).draft.save();
} 

function add_to_platform({github_full_name, npm_package_name, tags=null}) { 
    assert( tags===null || tags.every(tag => tag.constructor === Tag) );
    assert( Thing.things.logged_user.id );

    const validation_errors = (() => { 
        let validation_errors = null;
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
        return validation_errors;
    })(); 
    if( validation_errors ) {
        const err = new Error('Validation Error(s)');
        err.validation_errors = validation_errors;
        return Promise.reject(err);
    }

    const resolved_value = {
        resource: null,
        already_added: false,
    };

    return (
        new Thing({
            type: 'resource',
            github_full_name,
            npm_package_name,
            draft: {
                author: Thing.things.logged_user.id,
            },
        }).draft.save()
    )
    .then(([resource]) => {
        assert(resource);
        assert(resource.constructor === Resource);
        resolved_value.already_added = resource.history.length > 1;
        resolved_value.resource = resource;
    })
    .then(() => resolved_value);
} 
