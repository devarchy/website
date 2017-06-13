"use strict";
const assert = require('better-assert');
const assert_hard = require('assert');
const node_assert = require('assert');
const table_columns = require('../table').columns;
const timerlog = require('timerlog');
const obj_path = require('../../util/obj-path');

const util = module.exports = {
    retrieve_by_filter,
    map_props: {
        to_thing,
        to_database,
    }
};

function retrieve_by_filter(table_name, thing_props, {Thing, result_fields, transaction, orderBy, return_raw_request, db_handle/*, schema__date_props*/}={}) { 
    node_assert( 2 <= arguments.length && arguments.length<= 3, arguments );
    assert( arguments[2] === undefined || arguments[2].constructor===Object );
    assert( Thing );
    assert( Thing.database );
    assert( db_handle );
    assert( table_name );
    assert( thing_props && Object.keys(thing_props).length>=0 && thing_props.constructor===Object );
    assert( transaction === undefined || transaction.rid );
    assert( [undefined, null].includes(result_fields) || result_fields.constructor===Array && (result_fields.includes('id') && result_fields.length===1 || result_fields.includes('type')) );
    assert( orderBy===undefined || orderBy.constructor === String );

    timerlog({ 
        id: 'build_sql_request',
        tags: ['performance', 'db_processing'],
        start_timer: true,
    }); 

    // pruning fields in JS is faster
    if( result_fields && result_fields.length > 1 ) {
        var result_fields__js = result_fields;
        result_fields = null;
    }
    assert( !result_fields || result_fields.includes('id') && result_fields.length===1 );

    var request = db_handle(table_name);

    if( transaction ) {
        request = request.transacting(transaction);
    }

    request = request.select(
        ! result_fields ?
            '*' :
            [ ... new Set(
                result_fields
            )]
            .map(prop => {
                const prop_in_db = map_prop_to_database_select_expression(prop);

                return db_handle.raw(prop_in_db);
                if( prop_in_db === prop ) {
                    return prop;
                }
            })
    );

    {
        const column_values = util.map_props.to_database(thing_props);
        const column_json = column_values.json_data;
        delete column_values.json_data;

        request = add_where(request, column_values);

        obj_to_paths(column_json||{})
        .forEach(condition => {

            if( condition[0] === '_raw_filters' ) {
                assert_hard(condition[1].constructor===Array);
                assert_hard(condition.length===2);

                condition[1].forEach(raw_filter => {
                    request = request.whereRaw(raw_filter);
                });

                return;
            }

            const val = condition.slice(-1)[0];
            assert_hard(val!==undefined, thing_props);

            const property_selector = `'${condition.slice(-2)[0]}'`;

            const path_selector = ['json_data'].concat(condition.slice(0,-2).map(dir => `'${dir}'`)).join('->');

            if( val===null || val.constructor===Array || val === '_NOT_NULL' ) {
                const selector = path_selector + '->' + property_selector;

                if( val===null ) {
                    request = request.whereRaw(selector+' IS NULL');
                 // request = request.whereNull(selector); // throws `column "json_data->'npm_info'" does not exist`
                    return;
                }

                if( val === '_NOT_NULL' ) {
                    request = request.whereRaw(selector+' IS NOT NULL');
                    return;
                }

                if( val.constructor===Array ) {
                    request = request.whereRaw(selector+' \\?| ?', [val]);
                    return;
                }
            }

            const selector = path_selector + "->>" + property_selector;
            request = request.whereRaw(`lower(${selector}) = lower(?)`, val);
        });
    }

    if( orderBy ) {
        request = request.orderByRaw(orderBy);
    }

    Thing.debug.log.log(request.toString(), 'Transaction: '+(transaction||{}).rid);

    if( result_fields && !return_raw_request ) {
        request = request.options({rowMode: 'array'}); // return rows as arrays instead of objects
    }

    timerlog({ 
        id: 'build_sql_request',
        end_timer: true,
    }); 

    if( return_raw_request ) {
        return request;
    }

    const log_id_2 = timerlog({ 
        start_timer: true,
        tag: 'slowiness_tracker',
        measured_time_threshold: 3000,
        message: 'Slow database retrieval of `'+JSON.stringify(thing_props)+'`',
    }); 
    const log_id = timerlog({ 
        start_timer: true,
        tag: "performance",
        message: 'Database retrieval of `'+JSON.stringify(thing_props)+'`',
    }); 

    return (
        request
        .then(rows => {

            timerlog({ 
                id: log_id,
                end_timer: true,
            }); 
            timerlog({ 
                id: log_id_2,
                end_timer: true,
            }); 


            timerlog({ 
                id: 'sql_rows_to_thing_info',
                tags: ['performance', 'db_processing'],
                start_timer: true,
            }); 

            assert(['thing_event', 'thing_aggregate'].includes(table_name));
            if( table_name === 'thing_event' ) {
                rows
                .forEach(row => {
                    assert(!row.history);
                    assert(!row.json_data.history);
                    delete row.id_row;
                });
            }

            if( result_fields ) {
                rows = rows.map(row => map_prop_value_array_to_object(row, result_fields));
            } else {
                rows = rows.map(props_from_database => util.map_props.to_thing(props_from_database));
            }

            if( result_fields__js ) {
                rows = filter_props(rows, result_fields__js);
            }

            /* posponed because
                - `schema__date_props` depends on the Thing type of each row
                - we don't always have one single type?
            if( schema__date_props.length > 0 ) {
                rows
                .forEach(row => {
                    Object.entries(row)
                    .forEach(([prop, val]) => {
                        if( schema__date_props.includes[prop] && val ) {
                            row[prop] = new Date(val);
                        }
                    });
                });
            }
            */

            timerlog({ 
                id: 'sql_rows_to_thing_info',
                end_timer: true,
            }); 

            return rows;
        })
    );

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
        if( val === null ) {
            return;
        }
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

function to_database(props_from_thing) { 
    const props_for_database = {
        json_data: {},
    };

    assert( props_from_thing && Object.keys(props_from_thing).length>=0 && props_from_thing.length===undefined );
    assert( ! props_from_thing.id_thing );
    assert( ! props_from_thing.id_row );
    assert( ! props_from_thing.json_data );

    Array.from(new Set([
        ...Object.keys(props_from_thing),
        ...(
            Object.getOwnPropertyNames(props_from_thing)
            .filter(prop => ![null, undefined].includes(props_from_thing[prop]))
        ),
    ]))
    .forEach(prop => {
        const value = props_from_thing[prop];
        if( prop === 'subtype' ) {
            // nothing
        }
        else if( prop === 'id' )
            props_for_database.id_thing = value;
        else if( table_columns.both.indexOf(prop) !== -1 )
            props_for_database[prop] = value;
        else
            props_for_database.json_data[prop] = value;
    });

    assert( ! props_for_database.id );

    return props_for_database;
} 

function to_thing(props_from_database) { 
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

function filter_props(things, result_fields) { 

    timerlog({ 
        id: 'filter_db_props',
        disable: false,
        tags: ['performance', 'db_processing'],
        start_timer: true,
    }); 

    assert(things.constructor===Array);
    assert(result_fields.constructor===Array);

    const result_fields__map = {};
    result_fields.forEach(path => {
        let nested = result_fields__map;
        obj_path.as_array(path).forEach(key => {
            nested[key] = nested[key] || {};
            nested = nested[key];
        });
    });

    const things_new = things.map(filter)

    timerlog({ 
        id: 'filter_db_props',
        end_timer: true,
    }); 

    return things_new;

    function filter(thing) {
        const thing_new = {};
        filter_nested(thing, thing_new, result_fields__map);
        return thing_new;
    }

    function filter_nested(obj_old, obj_new, props) {
        for(var key in props) {
            if( Object.keys(props[key]).length > 0 ) {
                if( ! obj_old[key] ) continue;
                obj_new[key] = {};
                filter_nested(obj_old[key], obj_new[key], props[key]);
                continue;
            }
            if( obj_old[key] !== undefined ) {
                obj_new[key] = obj_old[key];
            }
        }
    }

    /*
    const d = new Date();
    var count = 0;
    things.forEach(thing => {
        traverse_obj(thing);
    });
    console.log(new Date() - d);
    console.log(count);
    function traverse_obj(obj) {
        if( ! ((obj||0) instanceof Object) ) {
            return;
        }
        for(var key in obj) {
            count++;
            traverse_obj(obj[key]);
        }
    }
    */

    /*
    return (
        things
        .map(thing => {
            const ret = {};
            if( ! result_fields ) {
                Object.assign(ret, thing);
            }
            if( result_fields ) {
                result_fields
                .forEach(path => {
                    const val = obj_path.get_val(thing, path);
                    if( [null, undefined].includes(val) ) {
                        return;
                    }
                    obj_path.set_val(ret, val, path);
                })
            }
            if( include_side_props ) {
                const props = Object.keys(thing);
                Object.getOwnPropertyNames(thing)
                .filter(prop => !props.includes(prop) && prop!=='draft')
                .forEach(prop => {
                    ret[prop] = thing[prop];
                });
            }
            return ret;
        })
    );
    */
} 
