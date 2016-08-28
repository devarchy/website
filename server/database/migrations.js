const assert = require('assert');
const Thing = require('./');


/*
migration__rename_project_to_resource();
*/
migration__recompute_tags();


function migration__recompute_tags() {
    Thing.database.management.migrate.recompute_things({
        filter_properties: {
            type: 'tag',
        },
        close_connections_when_done: true,
    });
}

function migration__recompute_all() {
    Thing.database.management.migrate.recompute_things({close_connections_when_done: true});
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

