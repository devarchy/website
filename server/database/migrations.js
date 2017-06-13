const assert = require('assert');
const Thing = require('./');
const Promise = require('bluebird'); Promise.longStackTraces();
const Promise_serial = require('promise-serial');
const validator = require('validator');
const github_api = require('../util/github-api');
require('timerlog')({disable_all: true});


Promise_serial(
    [
     // migration__remove_thing({type: 'resource', npm_package_name: 'angular2-data-table', github_full_name: 'swimlane/angular2-data-table'}),
     // migration__recompute_resources,
        /*
        migration__rename_catalog({name_old: 'angular-components', name_new: 'angular', markdown_list__github_full_name: 'brillout/awesome-angular-components', }),
        migration__rename_catalog({name_old: 'frontend-libraries', name_new: 'frontend', markdown_list__github_full_name: 'brillout/awesome-frontend-libraries', }),
        migration__rename_catalog({name_old: 'react-components', name_new: 'react', markdown_list__github_full_name: 'brillout/awesome-react-components', }),
        */
     // migration__recompute_specific_thing({type: 'tag', name: 'frontend-catalogs'}),
     // migration__recompute_specific_thing({type: 'resource', npm_package_name: 'react-sortable-tree'}),
     // migration__recompute_everything(),
        migration__recompute_specific_thing({type: 'tag', name: 'react'}),
     // migration__recompute_resources__with_cache,
     // migration__recompute_resources__with_cache,
     // migration__recompute_specific_thing({type: 'resource', npm_package_name: 'ng2-alfresco-core'}),
     // migration__add_meta_lists,
     // migration__recompute_specific_thing({type: 'resource', github_info: {full_name: 'brillout/awesome-frontend-libraries'}}),
     // migration__recompute_specific_thing({type: 'tag', name: 'react'}),
     // migration__recompute_specific_thing({type: 'tag', name: 'react-components'}),
     // migration__recompute_specific_thing({type: 'tag', name: 'angular-components'}),
     // migration__recompute_specific_thing({type: 'tag', name: 'vue'}),
     // migration__recompute_specific_thing({type: 'tag', name: 'frontend-libraries'}),
     // migration__recompute_catalogs,

     // migration__recompute_markdown_lists,

        Thing.database.close_connections,
    ]
 // , {log_progress: 'migration scripts executed'}
)
.then(() => {
    console.log('migration done');
});


// migration__recompute_specific_thing({type: 'tag', name: 'npm_angular2-components'}),
// migration__recompute_specific_thing({type: 'tag', name: 'redux'}),
function migration__recompute_specific_thing(filter_properties, opts) { 
    return () => (
        Thing.database.management.migrate.recompute_things(
            Object.assign(
                {
                    filter_properties,
                    /*
                    schema__args: {
                        cache_expiration_limit: null,
                    },
                    //*/
                },
                opts
            )
        )
    );
} 

function migration__rename_removed_column() { 
    return (
        Thing.database.management.migrate.rename_column({table: 'thing_aggregate', from: 'removed', to: 'is_removed'})
    );
} 
function migration__rename_removed_prop_in_events() { 
    return (
        Thing.database.management.migrate.events({
            map_row: ({json_data}) => {
                if( json_data.removed === undefined ) {
                    return null;
                }
                const changes = {
                    json_data: Object.assign({}, json_data),
                };
                changes.json_data.is_removed = changes.json_data.removed;
                delete changes.json_data.removed;
                return changes;
            },
        })
    );
} 
function migration__remove_prop_in_events(prop_name) { 
    return () => (
        Thing.database.management.migrate.events({
            map_row: ({json_data}) => {
                if( !(prop_name in json_data) ) {
                    return;
                }
                delete json_data[prop_name];
                return {
                    json_data: Object.assign({}, json_data),
                };
            },
        })
    );
} 

function migration__remove_thing(filter_properties) { 
    assert(filter_properties.type);
    let author;
    return () => (
        get_bot_id().then(id => author = id)
        .then(() =>
            Thing.database.load.things(filter_properties)
        )
        .then(things => {
            assert(things.length===1);
            const thing_props = Object.assign({}, filter_properties, {is_removed: true, author});
            return (
                new Thing(thing_props).draft.save()
                .then(([t]) => assert(t.is_removed===true))
            );
        })
    );
} 

function migration__recompute_everything() { 
    return () => (
        Thing.database.management.migrate.recompute_things({
            dont_cascade_saving: true,
            dont_apply_side_effects: true,
            dont_throw: true,
            schema__args: {
                cache_expiration_limit: null,
            },
        })
    );
} 

function migration__apply_all_side_effects() { 
    return () => (
        Thing.database.management.migrate.recompute_things()
    );
} 

function migration__category_ids() { 

    const old_to_new_map = {};
    const new_to_old_map = {};

    return (
        Thing.database.management.migrate.recompute_things({
            filter_properties: {
                type: 'tag',
                markdown_list__github_full_name: '_NOT_NULL',
            },
            dont_apply_side_effects: true,
        })
        .then(() =>
            Thing.database.load.things({
                type: 'tag',
                markdown_list__github_full_name: '_NOT_NULL',
            })
            .then(tags => {
                assert(tags.every(t => t.markdown_list__entries));

                assert(tags.length>=2);

                tags.forEach(tag => {
                    const categories = tag.markdown_list__entries;
                    assert(categories.constructor === Array);

                    categories.forEach(cat => {
                        const new_id = cat.id;
                        const old_id = get_id(cat);
                        assert(new_id && old_id);
                        assert(old_to_new_map[old_id]===undefined);
                        old_to_new_map[old_id] = new_id;
                        new_to_old_map[new_id] = old_id;
                    });

                    function get_id(cat) {
                        const text = cat.text;
                        assert(text);

                        const parent_category_id_old = (() => { 
                            const parent_category_id = cat.parent_category_id;
                            if( parent_category_id === null ) {
                                return tag.id;
                            }
                            assert(parent_category_id);
                            const parent_category = categories.find(c => c.id === parent_category_id);
                            assert(parent_category);
                            const parent_category_id_old = new_to_old_map[parent_category.id];
                            assert(parent_category_id_old);
                            return parent_category_id_old;
                        })(); 
                        assert(parent_category_id_old);

                        const id_local = slugify_old(text);
                        const id_global = parent_category_id_old+'_'+id_local;

                        return id_global;

                        function slugify_old(str) {
                            return str.toLowerCase().replace(/\s/g,'-').replace(/[^a-z0-9\-]/g,'');
                        }
                    }
                });
                console.log('map old id -> new id:');
                console.log(JSON.stringify(old_to_new_map, null, 2));
            })
        )
        .then(() => {
            let devarchy_bot_id;
            return (
                get_bot_id().then(id => devarchy_bot_id=id)
            )
            .then(() =>
                Thing.database.load.things({
                    type: 'tagged',
                    tagrequest: '_NOT_NULL',
                })
            )
            .then(things__tagged =>
                Promise_serial(
                    things__tagged.
                    map(tagged => () => {

                        const tagrequest_old = tagged.tagrequest;
                        assert(tagrequest_old);

                        if( new_to_old_map[tagrequest_old] ) {
                            console.log('already new category name: '+tagrequest_old);
                            return Promise.resolve();
                        }

                        const tagrequest_new = old_to_new_map[tagrequest_old];
                        assert(tagrequest_new, 'could not find '+tagrequest_old+' of Thing.resource:'+tagged.referred_resource);

                        console.log('saving '+tagrequest_old+' -> '+tagrequest_new);

                        tagged.draft.tagrequest = tagrequest_new;
                        tagged.draft.author = devarchy_bot_id;
                        return tagged.draft.save();

                    })
                )
            )
        })
        .then(() =>
            Thing.database.management.migrate.recompute_things({
                filter_properties: {
                    type: 'resource',
                },
                filter_fct: thing__resource => {
                    if( thing__resource.preview.tagreqs.length > 0 ) {
                        return true;
                    }
                    return false;
                },
            })
        )
    );
} 

function migration__preview_missing() { 
    return (
        Thing.database.management.migrate.recompute_things({
            filter_properties: {
                type: 'resource',
            },
            filter_fct: thing__resource => {
                    if( ! thing__resource.preview.tagreqs ) {
                        return true;
                    }
                 // if( thing__resource.preview.tags.some(tag => !tag) ) {
                 //     return true;
                 // }
                 // if( ! (thing__resource.github_info||{}).created_at ) {
                 //     return true;
                 // }
                    return false;
            },
        })
    );
} 

function migration__recompute_users_private_data() { 
    return (
        Thing.database.management.migrate.recompute_things({
            filter_properties: {
                type: 'user_private_data',
            },
        })
    );
} 

function migration__recompute_categories() { 
    return (
        Thing.database.management.migrate.recompute_things({
            filter_properties: {
                type: 'tag',
                referred_tag_markdown_list: '_NOT_NULL',
            },
        })
    );
} 

function migration__recompute_markdown_lists() { 
    return (
        Thing.database.management.migrate.recompute_things({
            filter_properties: {
                type: 'tag',
                markdown_list__github_full_name: '_NOT_NULL',
            },
        })
    );
} 

function migration__recompute_resources__with_cache() { 
    return (
        Thing.database.management.migrate.recompute_things({
            filter_properties: {
                type: 'resource',
            },
            dont_throw: true,
            schema__args: {
                cache_expiration_limit: null,
            },
        })
    );

} 

function migration__recompute_resources() { 
    return (
        Thing.database.management.migrate.recompute_things({
            filter_properties: {
                type: 'resource',
                /*
                _raw_filters: [
                    "jsonb_array_length(json_data->'preview'->'tags') > 1",
                ],
                */
            },
            filter_fct: resource => {
                if( ! resource.github_full_name ) {
                    return false;
                }
                if( resource.preview.tags.every(tagname => tagname.startsWith('npm_')) ) {
                    return false;
                }
                const hours_since_last_recompute = Math.floor((new Date() - new Date(resource.computed_at)) / (60*60*1000));
                if( hours_since_last_recompute < 12) {
                    return false;
                }
                return true;
            },
            schema__args: {
                cache_expiration_limit: 12 * 60*60*1000,
            },
        })
    );
} 

function migration__rename_project_to_resource() { 
    const promise = Thing.database.management.migrate.events({
        map_row: ({type, json_data}) => {
            const changes = {};

            if( type === 'project' ) {
                changes.type = 'resource';
            }

            const walk_result = walk_through_obj({obj: json_data});
            if( /project/.test(JSON.stringify(walk_result.obj))) {
                console.log(walk_result.obj);
            }
            assert(!/project/.test(JSON.stringify(walk_result.obj)));
            if( walk_result.modified ) {
                changes.json_data = walk_result.obj;
            }

            return Object.keys(changes).length>0 ? changes : null;
        },
    })
    .then(() =>
        Thing.database.management.migrate.recompute_things({filter_properties:{type: 'user'}, dont_cascade_saving: true})
    )
    .then(() =>
        Thing.database.management.migrate.recompute_things({filter_properties:{type: 'tagged'}, dont_cascade_saving: true})
    )
    .then(() =>
        Thing.database.management.migrate.recompute_things({filter_properties:{type: 'project'}, dont_cascade_saving: true})
    )
    .then(() =>
        Thing.database.management.migrate.recompute_things()
    )

    return promise;

    function walk_through_obj({obj, modified=false}) {
        assert(obj.constructor === Object);
        for(var key in obj) {
            let val = obj[key];

            if((obj[key]||1).constructor === Object) {
                const key__rec__result = walk_through_obj({obj: val});
                val = key__rec__result.obj;
                modified = modified || key__rec__result.modified;
            }

            if( key.includes('project') ) {
                obj[key.replace(/project/g, 'resource')] = val;
                delete obj[key];
                modified = true;
            }
        }
        return {obj, modified};
    }
} 

function migration__tagrequest__to__request_date() { 
    const SKIPS = [
        'react-components:ui-frameworks_ui-frameworks',
    ];
    const MAPPING = {
        'react-components:display-time-date-age': 'react-components:time-date-age',
        'react-components:set-children-of': 'react-components:set-children-of-head',
        'react-components:media': 'react-components:audio-video',
        'react-components:photo-image-gallery': 'react-components:photo-image',
        'react-components:mobile-frameworks': 'react-components:mobile',
    };
    let taggeds;
    let tags;
    let author;
    return (
        Promise.all([
            get_bot_id().then(id => author=id),
            Thing.database.load.things({
                type: 'tagged',
            })
            .then(taggeds_ => { taggeds = taggeds_ }),
            Thing.database.load.things({
                type: 'tag',
            })
            .then(tags_ => { tags = tags_ }),
        ])
        .then(() =>
            Promise_serial(
                taggeds
                .filter(t => t.tagrequest && !t.is_removed)
                .map(tagged => {
                    const tag__markdown_list = tags.find(({id}) => id===tagged.referred_tag);
                    assert(tag__markdown_list);

                    let category_name__local = tagged.tagrequest;
                    if( validator.isUUID(category_name__local.slice(0, 36)) ) {
                        category_name__local = category_name__local.slice(37);
                    }
                    let category_name = tag__markdown_list.name+':'+category_name__local;
                    category_name = MAPPING[category_name] || category_name;
                    const tag__markdown_category = tags.find(({name}) => name===category_name);

                    const referred_tag = (() => {
                        if( !tag__markdown_category ) {
                            if( SKIPS.includes(category_name) ) {
                                return tag__markdown_list.id;
                            }
                            console.log(JSON.stringify(tags.map(t => t.name).sort(), null, 2));
                            console.log(category_name);
                            assert(false);
                        }
                        assert(tag__markdown_category.id);
                        return tag__markdown_category.id;
                    })();

                    const referred_resource = tagged.referred_resource;

                    return () => (
                        new Thing({
                            author,
                            type: 'tagged',
                            referred_tag,
                            referred_resource,
                            request_date: new Date(tagged.created_at),
                            is_removed: false,
                        }).draft.save()
                        .then(() => {
                            if( tagged.referred_tag===referred_tag ) {
                                return;
                            }
                            return (
                                new Thing({
                                    author,
                                    type: 'tagged',
                                    id: tagged.id,
                                    referred_tag: tagged.referred_tag,
                                    referred_resource,
                                    is_removed: true,
                                }).draft.save()
                            )
                        })
                    );

                    /*
                        .then(([tagged_new]) => {
                            assert(tagged_new.is_a_request===true);
                            assert(
                                tagged_new.history.filter(ev => ev.is_a_request && ev.author===author).length===1,
                                JSON.stringify(tagged_new.history, null, 2)+'\n'+author
                            );
                            return (
                                Thing.database.management.migrate.events({
                                    map_row: (ev) => {
                                        assert(ev.id_thing);
                                        if( ev.id_thing !== tagged_new.id ) {
                                            return null;
                                        }
                                        assert(ev.author);
                                        if( ev.author !== author ) {
                                            return null;
                                        }
                                        if( ! ev.is_a_request ) {
                                            return null;
                                        }
                                     // if( ev.created_at.getTime() !== tagged_new.updated_at.getTime() ) {
                                     //     return null;
                                     // }
                                        if( ev.created_at.getTime() === tagged.created_at.getTime() ) {
                                            return null;
                                        }
                                        const changes = {
                                            created_at: new Date(tagged.created_at+10*1000),
                                        };
                                        console.log(changes.created_at);
                                        assert(changes.created_at.getTime()!==tagged.created_at.getTime());
                                        return changes;
                                    },
                                })
                            );
                        })

                    const tagged__target = taggeds.find(t => t.referred_tag===referred_tag && t.referred_resource===referred_resource);
                    if( tagged__target ) {
                        return;
                    }
                    return () => (
                        new Thing({
                            author,
                            id: tagged.id,
                            type: 'tagged',
                            referred_tag,
                            referred_resource,
                            is_a_request: true,
                            tagrequest: null,
                            is_removed: false,
                        }).draft.save()
                        .then(([tagged_updated]) => {
                            assert(tagged_updated.id === tagged.id);
                            assert(tagged_updated.history.some(h => h.tagrequest));
                            assert(tagged_updated.history.slice(-1).is_a_request===true);
                        })
                    );
                    */
                }),
                {log_progress: 'tagrequest -> request_date'}
            )
        )
    );
} 

function get_bot_id() { 
    return (
        Thing.database.load.things({
            type: 'user',
            github_login: 'devarchy-bot',
        })
        .then(([user]) => user.id)
    );
} 

function migration__declined_json() { 
    let declined_resources;
    let resources;
    let author;
    return (
        Promise.all([
            (
                get_bot_id().then(id => author = id)
            ),
            (
                github_api.repo.get_file({
                    full_name: 'brillout/awesome-react-components',
                    file_path: 'declined.json',
                })
                .then(content => {
                    return JSON.parse(content);
                })
                .then(content => {
                    assert(content.constructor===Object);
                    declined_resources = Object.keys(content);
                })
            ),
            (
                Thing.database.load.things({
                    type: 'resource',
                    preview: {tags: ['react-components']},
                })
                .then(resources_ => {
                    resources = resources_;
                    assert(resources.length>300);
                })
            ),
        ])
        .then(() =>
            Promise_serial(
                declined_resources
                .map(npm_package_name => {
                    const resource = resources.find(r => r.npm_package_name===npm_package_name);
                    assert(resource);
                    return resource;
                })
                .filter(resource =>
                    resource.preview.tagreqs
                    .some(({req_approved}) => req_approved!==false)
                )
                .map(resource =>
                    () => Promise.all(
                        resource.preview.tagreqs
                        .filter(({req_approved}) => req_approved!==false)
                        .map(({req_tag_name}) =>
                            Thing.database.load.things({
                                type: 'tag',
                                name: req_tag_name,
                            })
                            .then(([tag]) =>
                                new Thing({
                                    author,
                                    type: 'tagged',
                                    referred_resource: resource.id,
                                    referred_tag: tag.id,
                                    request_approved: false,
                                }).draft.save()
                            )
                        )
                    )
                )
                , {log_progress: 'declined resources'}
            )
        )
    );
} 

function migration__add_meta_lists() { 
    let author;
    return (
        get_bot_id().then(id => author = id)
        .then(() =>
            Promise_serial(
                [
                //  'brillout-test/websites',
                    'devarchy/frontend-catalogs',
                ]
                .map(markdown_list__github_full_name => () => {
                    return (
                        new Thing({
                            type: 'tag',
                            author,
                            markdown_list__github_full_name,
                            name: markdown_list__github_full_name.split('/')[1],
                        }).draft.save()
                    );
                })
            )
        )
    );
} 

function migration__recompute_catalogs() { 
    return (
        Thing.database.management.migrate.recompute_things({
            filter_properties: {
                type: 'tag',
                markdown_list__github_full_name: '_NOT_NULL',
            },
            dont_apply_side_effects: true,
        })
    );
} 

function migration__rename_catalog({name_old, name_new, markdown_list__github_full_name}) { 
    let author;
    return () => (
        get_bot_id().then(id => author = id)
        .then(() =>
            new Thing({
                type: 'tag',
                author,
                name: name_new,
                markdown_list__github_full_name,
            }).draft.save({dont_apply_side_effects: true})
        )
        .then(things => {
            assert(things.constructor===Array);
            assert(things.length>0);
            const [catalog] = things;
            assert(catalog);
            assert(catalog.type==='tag');
            assert(!catalog.referred_tag_markdown_list);
            assert(catalog.name===name_new);
            return (
                Thing.database.load.things({
                    type: 'tag',
                    preview: {tags: [name_old]},
                })
                .then(categories =>
                    Promise_serial(
                        categories
                        .map(category => () => {
                            assert(category.referred_tag_markdown_list===catalog.id);
                            assert(category.name.startsWith(name_old));
                            const name = name_new + category.name.slice(name_old.length);
                            assert(name.includes(name_new+':'));
                            return (
                                new Thing({
                                    type: 'tag',
                                    author,
                                    name: category.name,
                                    referred_tag_markdown_list: catalog.id,
                                    draft: {
                                        name,
                                    },
                                }).draft.save({dont_apply_side_effects: true})
                            );
                        })
                        , {log_progress: 'categories renamed'}
                    )
                )
            )
        })
        /*
        .then(() =>
            new Thing({
                type: 'tag',
                author,
                name: name_new,
                markdown_list__github_full_name,
            }).draft.save()
        )
        */
        .then(() =>
            Thing.database.management.migrate.recompute_things({
                filter_properties: {
                    type: 'tag',
                    preview: {tags: [name_old]},
                },
                dont_apply_side_effects: true,
            })
        )
        .then(() =>
            Thing.database.management.migrate.recompute_things({
                filter_properties: {
                    type: 'resource',
                    preview: {tags: [name_old]},
                },
                dont_apply_side_effects: true,
            })
        )
        .then(() =>
            Thing.database.load.things({
                preview: {tags: [name_old]},
            }).then(things => {
                assert(things.length===0);
            })
        )
    );
} 
