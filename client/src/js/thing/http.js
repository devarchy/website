import assert from 'assertion-soft';
import assert_soft from 'assertion-soft';
import timerlog from 'timerlog';
import http from '../util/http';
import user_tracker from '../user_tracker';
import {SERVER_URI} from '../util/server_uri';


export default {
    retrieve_things,
    view,
    logged_user,
    save,
};

function retrieve_things({properties_filter, result_fields}){ 
    assert(properties_filter && properties_filter.constructor === Object && Object.keys(properties_filter).length>0);

    const log_id = timerlog({ 
        message: 'retrieve things with '+JSON.stringify(properties_filter),
        start_timer: true,
        tags: [
         // 'client',
            'performance',
        ],
    }); 

    assert(['id', 'type', 'updated_at'].every(field => result_fields.includes(field)));
    return (
        api_request({
            method: 'GET',
            endpoint: 'things',
            params: {properties_filter, result_fields},
        })
        .then(ret => {
            timerlog({ 
                id: log_id,
                end_timer: true
            }); 
            return ret;
        })
    );
} 

function view(params){ 
    assert_soft(params);
    assert_soft(params.things);
    assert_soft(params.things.constructor === Array && params.things.length>0);
    assert_soft(params.things.every(thing_props => thing_props && thing_props.constructor === Object && Object.keys(thing_props).length>0));
    assert_soft([true, false].includes(params.show_removed_things));

    return api_request({
        method: 'GET',
        endpoint: 'view',
        params,
    });
} 

function save(thing_info, thing_key){ 
    assert(thing_info && thing_info.constructor === Object && Object.keys(thing_info).length>0);
    assert(thing_info.type || thing_info.id);

    return api_request({
        method: 'POST',
        endpoint: 'save',
        body: thing_info,
        thing_key,
    });
} 

function logged_user() { 
    // babel can't handle this dependency on top of this file (webpack can)
    const Thing = require('./index.js').default;

    return api_request({
        method: 'GET',
        endpoint: 'user',
    })
    .then(output => {
        if( output === null ) {
            return output;
        }
        assert( output.constructor === Object );
        assert( output.things_matched.constructor === Array );
        assert( output.things_matched.length <= 1 );
        return output;
    })
    .then(output => {
        const thing = output && output.things_matched[0];
        Thing.things.logged_user = thing || null;
        if( thing ) {
            assert_soft(thing.type==='user');
            const user_provider_and_name = thing.user_provider_and_name;
            assert_soft(user_provider_and_name);
            user_tracker.set_user_id(user_provider_and_name);
        }
        return output;
    });
} 

function api_request({method, endpoint, params, body, thing_key}) { 
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
    .then(output => {
        log_id = timerlog({ 
            message: 'Processing of response '+method+' /api/'+endpoint,
            start_timer: true,
            tags: [
                'client',
                'performance'
            ],
         // measured_time_threshold: 100
        }); 
        if( output === null ) {
            output = [];
        }
        assert( [Object, Array].includes(output.constructor) );
        if( output.constructor === Array ) {
            output = {
                things_matched: output,
            };
        }
        assert( output.things_matched.constructor === Array );
        output.things_matched.forEach(thing_info => {
            assert( thing_info.id, JSON.stringify(thing_info, null, 2) );
            assert( thing_info.type );
            assert( ! thing_info.draft );
            assert( ! thing_info.json_data );
        });
        if( method === 'POST' ) {
            const thing_info = body;
            assert(thing_info.type);
            assert(output.things_matched.length >= 1);
            assert(output.things_matched[0].type === thing_info.type, '`'+output.things_matched[0].type+'!=='+thing_info.type+'`');
            assert(output.things_matched[0].id === thing_info.id || ! thing_info.id);
        }
        return output;
    })
    .then(output => {
        output.things_matched = output.things_matched.map((thing_info, i) => {
            let key;
            if( thing_key && i === 0 ) {
                key = thing_key;
            }
            else {
                key = (Thing.things.all.find(t => t.id === thing_info.id)||{}).key;
            }
            let thing_old = Thing.things.id_map[key];
            let thing_new = new Thing(thing_info, key);
            if( ! thing_old ) {
                return thing_new;
            }
            const old_updated_at = new Date(thing_old.updated_at);
            const new_updated_at = new Date(thing_new.updated_at);
            assert(old_updated_at.getTime()>0);
            assert(new_updated_at.getTime()>0);
            if( old_updated_at > new_updated_at ) {
                return thing_old;
            } else {
                return thing_new;
            }
        });
        return output;
    })
    .then(output => {
        timerlog({ 
            id: 'insert_in_arrays',
            start_timer: true,
            tags: ['client', 'performance'],
            measured_time_threshold: 50,
        }); 
        output.things_matched.forEach(thing => {
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
        return output;
    })
    .then(output => {
        assert(output);
        assert(output.constructor === Object);
        assert(output.things_matched.constructor === Array);
        timerlog({ 
            id: log_id,
            end_timer: true
        }); 
        return output;
    });

    assert(false);

} 
