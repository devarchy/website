const assert = require('assert');
const Thing = require('./');

require('timerlog')({disable_all: true});


migration__recompute_resources();
/*
migration__category_ids();
migration__recompute_tags();
*/


function migration__recompute_all() {
    Thing.database.management.migrate.recompute_things({close_connections_when_done: true});
}

function migration__category_ids() { 
    const Promise_serial = require('promise-serial');

    const old_to_new_map = {};
    const new_to_old_map = {};

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
            assert(tags.every(t => t.markdown_list__data));

            assert(tags.length>=2);

            tags.forEach(tag => {
                const categories = tag.markdown_list__data;
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
            Thing.database.load.things({
                type: 'user',
                github_login: 'devarchy-bot',
            })
            .then(([user]) => {assert(user.id); devarchy_bot_id = user.id})
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
            close_connections_when_done: true,
        })
    );
} 

function migration__preview_missing() {
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
        close_connections_when_done: true,
    });
}

function migration__recompute_tags() {
    Thing.database.management.migrate.recompute_things({
        filter_properties: {
            type: 'tag',
        },
        close_connections_when_done: true,
    });
}

function migration__recompute_resources() {
    Thing.database.management.migrate.recompute_things({
        filter_properties: {
            type: 'resource',
        },
        close_connections_when_done: true,
    });
}

function migration__rename_project_to_resource() {
    Thing.database.management.migrate.events({
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
        Thing.database.management.migrate.recompute_things({close_connections_when_done: true})
    )

    return;

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

