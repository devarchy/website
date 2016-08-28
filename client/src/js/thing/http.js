import assert from 'assert';
import timerlog from 'timerlog';
import http from '../util/http';
import {is_npm_package_name_valid} from '../util/npm';
import Promise from 'bluebird';
Promise.longStackTraces();


const SERVER_URI = (() => {
    if( typeof window === 'undefined' ) {
        return 'http://localhost:8081';
        // assert( typeof global !== 'undefined' && global.server_uri);
        // return global.server_uri;
    }
    if( window.location.hostname !== 'localhost' )
        return window.location.origin;
    return window.location.protocol + '//' + window.location.hostname + ':8081';
})();

export default {
    retrieve_things,
    view,
    logged_user,
    save,
};

function retrieve_things({properties_filter, result_fields}){ 
    assert(properties_filter && properties_filter.constructor === Object && Object.keys(properties_filter).length>0);

    return request({
        method: 'GET',
        endpoint: 'things',
        params: {properties_filter, result_fields},
    });
} 

function view(conditions){ 
    assert(conditions && conditions.constructor === Array && conditions.length>0);
    assert(conditions.every(condition => condition && condition.constructor === Object && Object.keys(condition).length>0));

    return request({
        method: 'GET',
        endpoint: 'view',
        params: conditions,
    });
} 

function save(thing_info, thing_key){ 
    assert(thing_info && thing_info.constructor === Object && Object.keys(thing_info).length>0);
    assert(thing_info.type || thing_info.id);

    return request({
        method: 'POST',
        endpoint: 'save',
        body: thing_info,
        thing_key,
    });
} 

function logged_user() { 
    // babel can't handle this dependency on top of this file (webpack can)
    const Thing = require('./index.js').default;

    return request({
        method: 'GET',
        endpoint: 'user',
    })
    .then(things_info => {
        assert( things_info );
        assert( things_info.constructor === Array );
        assert( things_info.length <= 1 );
        return things_info[0] || null;
    })
    .then(logged_user => {
        Thing.things.logged_user = logged_user;
    })
    .catch(err => {
        if( (err||{}).constructor !== http.HttpError ) {
            throw err;
        }
        assert(err.status!==undefined);
        if( err.status === 401 ) {
            return null;
        } else {
            console.log(err);
            throw err;
        }
    });
} 

function request({method, endpoint, params, body, thing_key}) { 
    // babel can't handle this dependency on top of this file (webpack can)
    const Thing = require('./index.js').default;

    assert( (method==='POST') === !!body );

    const uri = SERVER_URI + '/api/' + endpoint + ( params ? '/'+encodeURIComponent(JSON.stringify(params)) : '' );

    let log_id;

    return (
        http({
            method,
            uri,
            body,
            json: true,
        })
    )
    .then(things_info => {
        log_id = timerlog({ 
            message: 'Processed Response '+method+' /api/'+endpoint,
            start_timer: true,
            tag: 'performance',
            measured_time_threshold: 100
        }); 
        assert( things_info && things_info.constructor === Array );
        things_info.forEach(thing_info => {
            assert( thing_info.id );
            assert( thing_info.type );
            assert( ! thing_info.draft );
            assert( ! thing_info.json_data );
        });
        if( method === 'POST' ) {
            const thing_info = body;
            assert(thing_info);
            assert(things_info.length >= 1);
            assert(things_info[0].type === thing_info.type, '`'+things_info[0].type+'!=='+thing_info.type+'`');
            assert(things_info[0].id === thing_info.id || ! thing_info.id);
        }
        return things_info;
    })
    .then(things_info =>
        things_info.map((thing_info, i) => {
            let key;
            if( thing_key && i === 0 ) {
                key = thing_key;
            }
            else {
                key = (Thing.things.all.find(t => t.id === thing_info.id)||{}).key;
            }
            let thing_old = Thing.things.id_map[key];
            let thing_new = new Thing(thing_info, key);
            if( thing_old ) {
                Object.assign(thing_new.query_matches, thing_old.query_matches);
            }
            return thing_new;
        })
    )
    .then(things => {
        const markdown_tags = get_markdown_tags(things);
        return markdown_tags.length === 0 ? things : things.concat(markdown_tags);
    })
    .then(things => {
        timerlog({ 
            tag: 'performance',
            id: 'insert_in_arrays',
            start_timer: true,
            measured_time_threshold: 50
        }); 
        things.forEach(thing => {
            Thing.things.id_map[thing.key] = thing;

            const all = Thing.things.all;
            const index = all.findIndex(t => t.key===thing.key);
            all[ index !== -1 ? index : all.length ] = thing;

            const all_of_type = (Thing.things.of_type[thing.type] = (Thing.things.of_type[thing.type] || []));
            const index_of_type = all_of_type.findIndex(t => t.key===thing.key);
            all_of_type[ index_of_type !== -1 ? index_of_type : all_of_type.length ] = thing;
        });
        timerlog({ 
            id: 'insert_in_arrays',
            end_timer: true
        }); 
        return things;
    })
    .then(things => {
        assert(things);
        assert(things.constructor === Array);
        timerlog({ 
            id: log_id,
            end_timer: true
        }); 
        return things;
    });

    assert(false);

    function get_markdown_tags(things) {
        const markdown_tags = [];
        const global_ids = {};
        things.forEach(thing => {
            if( thing.markdown_list__data ) {
                assert(thing.type==='tag');
                add_markown_tags(thing.markdown_list__data.subheaders, thing);
            }
        });

        return markdown_tags;

        function add_markown_tags(headers, parent_tag) {
            const local_ids = {};
            headers.forEach(({text, subheaders, resources, resources_all, header_description}) => {
                const id_local = text.toLowerCase().replace(/\s/g,'-').replace(/[^a-z0-9\-]/g,'');
                assert(!local_ids[id_local]);
                local_ids[id_local] = true;

                const id_global = parent_tag.id+'_'+id_local;
                assert(!global_ids[id_global]);
                global_ids[id_global] = true;

                const tagged_resources = resources
                    // TODO - figure out what went wron with these two npm packages
                    .filter(({npm_package_name}) => !['redux-remote-monitor', 'relay-nested-routes'].includes(npm_package_name))
                    .filter(({github_full_name}) => !!github_full_name);

                if( resources_all.filter(({github_full_name}) => !!github_full_name).length === 0 ) {
                    return;
                }

                const markdown_tag = new Thing({
                    type: 'tag',
                    id: id_global,
                    name: id_global,
                    parent_tag,
                    tagged_resources,
                    title: text,
                    definition: (header_description||{}).text,
                });
                markdown_tags.push(markdown_tag);
                add_markown_tags(subheaders, markdown_tag);
            });
        }
    }
} 
