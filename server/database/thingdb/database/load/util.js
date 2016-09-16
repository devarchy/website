"use strict";
const connection = require('../connection');
const assert = require('better-assert');
const node_assert = require('assert');
const table_columns = require('../table').columns;
const timerlog = require('timerlog');

const util = module.exports = {
    retrieve_by_filter,
    map_props: {
        to_thing: map_props_to_thing,
        to_database: map_props_to_database,
    }
};

function retrieve_by_filter(table_name, thing_props, {result_fields, transaction, orderBy, return_raw_request}={}) {
    node_assert( 2 <= arguments.length && arguments.length<= 3, arguments );
    assert( arguments[2] === undefined || arguments[2].constructor===Object );
    assert( table_name );
    assert( thing_props && Object.keys(thing_props).length>=0 && thing_props.constructor===Object );
    assert( transaction === undefined || transaction.rid );
    assert( [undefined, null].includes(result_fields) || result_fields.constructor===Array && (result_fields.includes('id') || result_fields.includes('type')) );
    assert( orderBy===undefined || orderBy.constructor === String );

    const Thing = require('../../index.js');

    const knex = connection();

    var request = knex(table_name);

    if( transaction ) {
        request = request.transacting(transaction);
    }

    request = request.select(
        result_fields ?
            [ ... new Set(
                result_fields
            )]
            .map(prop => {
                const prop_in_db = map_prop_to_database_select_expression(prop);

                return knex.raw(prop_in_db);
                if( prop_in_db === prop ) {
                    return prop;
                }
            }) :
            '*'
    );

    {
        const column_values = util.map_props.to_database(thing_props);
        const column_json = column_values.json_data;
        delete column_values.json_data;

        request = add_where(request, column_values);

        obj_to_paths(column_json||{})
        .forEach(path_val => {
            const val = path_val.slice(-1)[0];
            assert(val!==undefined, thing_props);
            const path = path_val.slice(0,-1).map(dir => `'${dir}'`);
            const property = path.slice(-1)[0];
            const object_path = ['json_data'].concat(path.slice(0,-1));
            const json_path__base = object_path.join('->');
            if( val===null || val.constructor===Array || val === '_NOT_NULL' ) {
                const json_path = json_path__base + '->' + property;
                if( val===null ) {
                    request = request.whereRaw(json_path+' IS NULL');
                 // request = request.whereNull(json_path); // throws `column "json_data->'npm_info'" does not exist`
                } else if( val === '_NOT_NULL' ) {
                    request = request.whereRaw(json_path+' IS NOT NULL');
                } else if( val.constructor===Array ) {
                    request = request.whereRaw(json_path+' \\?| ?', [val]);
                }
            } else {
                const json_path = json_path__base + '->>' + property;
                request = request.whereRaw(`lower(${json_path}) = lower(?)`, val);
            }
        });
    }

    if( orderBy ) {
        request = request.orderByRaw(orderBy);
    }

    Thing.debug.log.log(request.toString(), 'Transaction: '+(transaction||{}).rid);

    if( return_raw_request ) {
        return request;
    }

    if( result_fields ) {
        request = request.options({rowMode: 'array'}); // return rows as arrays instead of objects
    }

 // console.log(request.toString());

    const log_id = timerlog({ 
        start_timer: true,
        message: 'Retrieving `'+JSON.stringify(thing_props)+'`',
    }); 

    return request.then(rows => {
        timerlog({ 
            id: log_id,
            end_timer: true,
        }); 
        assert(['thing_event', 'thing_aggregate'].includes(table_name));
        if( table_name === 'thing_event' ) {
            rows.forEach(row => {
                assert(!row.history);
                assert(!row.json_data.history);
                delete row.id_row;
            });
        }

        if( result_fields ) {
            return rows.map(row => map_prop_value_array_to_object(row, result_fields));
        }

        return rows.map(props_from_database => util.map_props.to_thing(props_from_database));
    })
    /*
    .then(things_props => {
        console.log(request.toString());
        console.log(things_props.length);
        console.log(things_props[0]);
        return things_props;
    })
    //*/
    ;

    function obj_to_paths(obj){
        var paths = [];
        for(var dir in obj) {
            if( obj[dir] && obj[dir].constructor === Object ) {
                paths = paths.concat(obj_to_paths(obj[dir]).map(path => [dir].concat(path)));
            }
            else {
                paths.push([dir, obj[dir]]);
            }
        }
        return paths;
    }

    // extend knex's where function to support `{computed_at: {operator: '<', value: new Date()-1000*60*60*24}}`
    function add_where(request, column_values) {

        Object.entries(column_values)
        .forEach(([column_name, column_value]) => {
            if( (column_value||0).constructor === Object ) {
                assert((column_value.operator||0).constructor === String && column_value.value !== undefined);
                delete column_values[column_name];
                request = request.where(column_name, column_value.operator, column_value.value);
            }
        });

        return request.where(column_values);
    }
}

function map_prop_to_database_select_expression(prop) {
    if( prop === 'id' )
        return 'id_thing';
    else if( table_columns.both.indexOf(prop) !== -1 )
        return prop;
    else
        return "json_data->"+prop.split('.').map(k=>"'"+k+"'").join('->');
}
function map_prop_value_array_to_object(prop_values, result_fields) {
    assert(prop_values.constructor === Array);
    const props = {};
    prop_values.forEach((val, i) => {
        let prop_parent = props;
        const key__path = result_fields[i].split('.');
        const key__last = key__path.pop();
        key__path.forEach(key => {
            assert(prop_parent[key] === undefined || prop_parent[key].constructor === Object);
            prop_parent[key] = prop_parent[key] || {};
            prop_parent = prop_parent[key];
        });
        prop_parent[key__last] = val;
    });
    return props;
}

function map_props_to_database(props_from_thing) {
    const Thing = require('../../index.js');

    const props_for_database = {
        json_data: {},
    };

    assert( props_from_thing && Object.keys(props_from_thing).length>=0 && props_from_thing.length===undefined );
    assert( ! props_from_thing.id_thing );
    assert( ! props_from_thing.id_row );
    assert( ! props_from_thing.json_data );

    for(let prop in props_from_thing) {
        const value = props_from_thing[prop];
        if( prop === 'id' )
            props_for_database.id_thing = value;
        else if( table_columns.both.indexOf(prop) !== -1 )
            props_for_database[prop] = value;
        else
            props_for_database.json_data[prop] = value;
    }

    assert( ! props_for_database.id );

    return props_for_database;
}

function map_props_to_thing(props_from_database) {
    const props_for_thing = {};

    assert( ! props_from_database.id );
    assert( ! props_from_database.row_id ); // doesn't make sense to use this function for events since events are internal
    assert( props_from_database.id_thing );
    assert( Object.keys(props_from_database).length === 1 || props_from_database.json_data );

    Object.assign(props_for_thing, props_from_database);
    Object.assign(props_for_thing, (props_from_database.json_data||{}));
    props_for_thing.id = props_from_database.id_thing;
    delete props_for_thing.json_data;
    delete props_for_thing.id_thing;
    delete props_for_thing.views;

    // treat empty database values as non existent instead of a property set to null ?
    // - we currently don't anymore because we need that to remove optional properties
    // for(var i in props_for_thing) {
    //     if( props_for_thing[i] === null ) {
    //         delete props_for_thing[i];
    //     }
    // }

    assert( props_for_thing.id );
    assert( ! props_for_thing.id_thing );
    assert( ! props_for_thing.id_row );
    assert( ! props_for_thing.json_data );

    return props_for_thing;
}
