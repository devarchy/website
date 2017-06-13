"use strict";
if( !global._babelPolyfill ) { require('babel-polyfill'); }
const plugin_memory_cache = require('./plugins/memory-cache');
const plugin_serializer = require('./plugins/serializer');
const assert = require('assert');
const assert_hard = require('assertion-soft/hard');
const assert_soft = require('assertion-soft');
const db_interface = require('./db_interface');
const migrate = require('./migrate');
const validate = require('./validate');
const validator = require('validator');
const interpolate = require('./interpolate');
const Promise = require('bluebird'); Promise.longStackTraces();
const uuid = require('node-uuid');
const debug = require('./debug');
const Promise_serial = require('promise-serial');
const schema_common = require('./schema_common');
const deepFreeze = require('../../util/deepFreeze');
const memoize = require('../../util/memoize');
const deepAssign = require('./util/deep-assign');
const deep_equal = require('./util/deep-equal');
const timerlog = require('timerlog');


module.exports = class ThingDB { 
    constructor({connection, schema}) {
        {
            const error_suffix = " required when constructing a `"+this.constructor.name+"` instance";
            if( !connection ) {
                throw new Error("`connection`"+error_suffix);
            }
            if( !schema ) {
                throw new Error("`schema`"+error_suffix);
            }
        }

        const Thing = stateful_thing_class.apply(null, arguments);

        return Thing;
    }
}; 


function stateful_thing_class({schema, connection, http_max_delay=null, dont_throw_on_connection_errors=false, schema__args}) {

    // internal state
    deepFreeze(schema);
    deepFreeze(connection);
    deepFreeze(http_max_delay);
    assert(schema);
    assert(connection);
    assert(http_max_delay!==undefined);
    let unique_constraints_installed = false;
    let connection_established = false;
    let db_handle;
    const schema__args__addendum = schema__args;


    const _plugins = (() => {
        const all_plugs = {
            plugs_load_things: [
                root_plug_load_things,
            ],
            plugs_thing_collection: [
            ],
            plugs_save_thing: [
            ],
        };

        const _plugins = {
            run_plugs,
            all_plugs,
        };

        plugin_memory_cache({all_plugs});
        plugin_serializer({all_plugs});

        return _plugins;

        function run_plugs({plugs, args, root_plug}) {
            assert(plugs.constructor===Array);
            assert(plugs.constructor.length>0);
            assert(args===undefined || args.length.constructor===Number);

            const process = chain_plugs(plugs, args);

            return process();

            function chain_plugs(plugs, args) {
                let process = function(){
                    throw new Error('you are the first plug, hence there is nothing to resume');
                };

                [
                    ...(root_plug ? [root_plug] : []),
                    ...plugs,
                ]
                .forEach(plug => {
                    const plug_args = {args, resume_process: process};
                    process = () => {
                        const p = plug(plug_args);
                        if( !p || !p.then ) {
                            throw new Error('a plug should always return a Promise');
                        }
                        return p;
                    };
                });

                return process;
            }
        }

        function root_plug_load_things({args}) {
            const [thing_props, opts={}] = args;
            opts.Thing = Thing;
            opts.db_handle = db_handle;
            return (
                db_interface.load_things(thing_props, opts)
                .then(things => ({things_matched: things}))
            );
        }
    })();

    const SAVE_TYPE = Symbol();
    const SAVE_TYPES = {
        IS_INSERT: Symbol(),
        IS_UPDATE: Symbol(),
        IS_UPSERT: Symbol(),
    };
    const ID_USER = Symbol();
    const ID_USER_GENERATED = Symbol();
    const ID_GENERATED = Symbol();
    const _delete_id = Symbol();
    const _generate_id = Symbol();
    const _install_id = Symbol();
    const THING_IS_NEW = Symbol();
    const LOAD_ME = Symbol();
    const SYNC_WITH_DB = Symbol();
    const IS_TIMING_ERROR = Symbol();

    class Thing {
        constructor(props) { 
            if( ! props ) {
                throw new Error('object holding initial properties of thing is required when constructing a Thing');
            }
            if( ! props.id && ! props.type ) {
                throw new Error('when constructing a Thing, `type` or `id` is required');
            }

            schema_wrapper.get_non_enumerable_props()
            .forEach(prop => {
                let descriptor = {
                    writable: true,
                };
                if( prop === 'subtype' ) {
                    descriptor = {
                        configurable: true,
                        get: function() {
                            return (
                                schema_wrapper.get_subtype_name(this)
                            );
                        },
                        set: function() {
                            // TODO: remove me
                            // assert(false);
                        },
                    };
                }
                Object.defineProperty(this, prop, descriptor);
            });

            const draft = props.draft;
            delete props.draft;

            Object.assign(this, props);

            assert(this.type || this[ID_USER]);

            Object.defineProperty(this, 'draft', {
                value: new Draft(this),
                enumarable: false,
                configurable: false,
                writable: false,
            });
            Object.assign(this.draft, draft);

        } 

        set id(id_new) { 
            if( !id_new || id_new.constructor !== String || ! validator.isUUID(id_new) ) {
                throw new Error('`id` is expected to be a UUID, instead `id=='+id_new+'`');
            }

            this[ID_USER] = id_new;
            delete this[ID_GENERATED];

            this[_install_id]();
        } 

        [_generate_id]() { 
            assert(this[ID_GENERATED]===undefined);
            this[ID_GENERATED] = uuid.v4();
            this[_install_id]();
        } 

        generate_id() { 
            if( ! this[ID_USER] && ! this[ID_USER_GENERATED] ) {
                this[ID_USER_GENERATED] = uuid.v4();
                this[_install_id]();
            }
        } 

        [_install_id]() { 
            Object.defineProperty(
                this,
                'id',
                {
                    enumerable: true,
                    configurable: true,
                    get: function() {
                        return (
                            this[ID_USER] || this[ID_USER_GENERATED] || this[ID_GENERATED]
                        );
                    },
                    set: function(id_new) {
                        if( id_new !== this.id ) {
                            throw new Thing.ValidationError("ID is immutable and it can't be changed from `"+this.id+"` to `"+id_new+"`");
                        }
                    },
                }
            );
        } 

        [_delete_id]() { 
            delete this[ID_GENERATED];
            delete this[ID_USER];
            if( this[ID_USER_GENERATED] ) {
                this[_install_id]();
            } else {
                delete this.id;
            }
        } 

        get [SAVE_TYPE] () { 
            const has_upsert_props = (() => {
                const keys = Object.keys(this);
                return (
                    keys.length
                    - (keys.includes('id')?1:0)
                    - (keys.includes('type')?1:0)
                ) > 0
            })();

            if( ! has_upsert_props ) {
                if( this[ID_USER] ) {
                    return SAVE_TYPES.IS_UPDATE;
                }
                return SAVE_TYPES.IS_INSERT;
            }

            if( this[ID_USER_GENERATED] ) {
                throw new Thing.ValidationError("Using a generated ID of a thing to then upsert this thing doesn't make sense (The ID of the thing can't be known before resolving the upsert). The thing in question:\n"+this);
            }

            if( !this.type ) {
                throw new Thing.ValidationError("`type` is required when upserting following thing:\n"+this);
            }

            return SAVE_TYPES.IS_UPSERT;
        } 

        [LOAD_ME] ({transaction, schema__args}) { 
            return Promise.resolve()
                .then(() => {
                    const st = this[SAVE_TYPE];

                    if( st === SAVE_TYPES.IS_INSERT ) {
                        this[_generate_id]();
                        this[THING_IS_NEW] = true;
                        return Promise.resolve();
                    }

                    if( st === SAVE_TYPES.IS_UPDATE ) {
                        return load_thing_by_id.call(this);
                    }

                    if( st === SAVE_TYPES.IS_UPSERT ) {
                        return resolve_upsert.call(this);
                    }

                    assert(false);
                })
                .then(() => {
                    assert( this.id );
                });


            function load_thing_by_id() {
                assert( this.id );
                assert( this[ID_USER] );
                assert( ! this[ID_USER_GENERATED] );
                return (
                    Thing.database.load.things({id: this.id}, {transaction})
                )
                .then(things => {
                    assert( things.length === 1 );
                    if( this.type !== undefined && things[0].type !== this.type ) {
                        throw new Error("Thing with ID `"+this.id+"` is of type `"+things[0].type+"` and not `"+this.type+"`");
                    }
                    delete_props(this);
                    thing_assign(this, things[0]);
                })
            }

            function resolve_upsert() {
                assert( ! this[ID_USER_GENERATED] );
                assert( this.type );

                const author = this.draft.author || this.author;

                interpolate.compute_values(this, {
                    Thing,
                    only_sync: true,
                    required_props_may_be_missing: true,
                    schema__props__ordered: schema_wrapper.get_props_ordered(this),
                    schema__args: Object.assign({}, schema__args__addendum, schema__args),
                });

                const unique_prop_sets = (() => {
                    const unique_prop_sets = [];
                    const prop_set = {};
                    for(let prop in this) {
                        if( schema_wrapper.prop_is_unique(this, prop) ) {
                            unique_prop_sets.push({
                                [prop]: this[prop],
                                type: this.type,
                            });
                        }
                        if( schema_wrapper.prop_is_part_of_unique_set(this, prop) ) {
                            prop_set[prop] = this[prop];
                        }
                    }
                    if( Object.keys(prop_set).length>0 ) {
                        unique_prop_sets.push(Object.assign(prop_set, {type: this.type}));
                    }
                    return unique_prop_sets;
                })();
                assert_hard(
                    unique_prop_sets.length>0,
                    [
                        'unique key is missing in',
                        this,
                        'with schema',
                        JSON.stringify(schema_wrapper.get_props_spec(this), null, 2),
                    ].join('\n')
                );

                return Promise.all(
                    unique_prop_sets.map(props => Thing.database.load.load_things_by_props(props, {transaction}))
                )
                .then( array_of_things =>
                    array_of_things.reduce((acc, {things_matched: curr}) => {
                        assert(curr.constructor===Array);
                        curr.forEach(thing => {
                            assert(thing[ID_USER]);
                            assert(thing.id);
                            if( ! acc.find(thing_ => thing_.id === thing.id) ) {
                                acc.push(thing);
                            }
                        });
                        return acc;
                    }, [])
                )
                .then( things => {
                    if( things.length > 1 ) {
                        throw new Thing.ValidationError(
                            [
                                "Upserting following thing will lead to violation of `is_unique` constraint",
                                this.toString(),
                                "Because of following already existing things",
                            ].concat(
                                things
                            )
                            .join('\n')
                        );
                    }

                    const thing_in_db = things[0];

                    if( this.id && !thing_in_db ) {
                        throw new Thing.ValidationError("Couldn't not find thing with ID `"+this.id+"` while upserting\n"+this.toString());
                    }

                    if( thing_in_db ) {
                        assert(
                            Object
                            .keys(this)
                            .some(prop => {
                                if( ! schema_wrapper.prop_is_unique(this, prop) && ! schema_wrapper.prop_is_part_of_unique_set(this, prop) ) {
                                    return false;
                                }
                                const v1 = this[prop];
                                const v2 = thing_in_db[prop];
                                return (
                                    [v1, v2].every(v => (v||0).constructor === String) ?
                                        v1.toLowerCase() === v2.toLowerCase() :
                                        v1 === v2
                                );
                            })
                        );
                    }

                    {
                        const schema__not_user_generated_props = schema_wrapper.get_not_user_generated_props();
                        for(var prop in this) {
                            if( ['type', 'id', 'author', ].includes(prop) ) {
                                continue;
                            }
                            if( schema__not_user_generated_props.includes(prop) ) {
                                continue;
                            }
                            if( thing_in_db && thing_in_db[prop] === this[prop] ) {
                                continue;
                            }
                            if( schema_wrapper.get_interpolated_props(this).includes(prop) ) {
                                continue;
                            }
                            if(
                                (
                                    ! thing_in_db &&
                                    schema_wrapper.get_props_with_default_val(this).includes(prop) &&
                                    this[prop] === schema_wrapper.get_default_value(this, prop)
                                )
                            ) {
                                    continue;
                            }
                            this.draft[prop] = this[prop];
                            delete this[prop];
                        }
                    }

                    const draft_is_empty = thing => Object.keys(thing.draft).length === 0;

                    if( thing_in_db ) {
                        assert( draft_is_empty(thing_in_db) );
                        thing_assign(this, thing_in_db);
                    }

                    if( !thing_in_db ) {
                        this[_generate_id]();
                        this[THING_IS_NEW] = true;
                    }

                    assert(this.id);

                    {
                        const author_is_missing = () => ! this.draft.author && ! draft_is_empty(this);
                        if( author_is_missing() && author ) {
                            this.draft.author = author;
                        }
                        assert( schema.user );
                        if( author_is_missing() && this.type === 'user' ) {
                            assert(this.id);
                            this.draft.author = this.id;
                        }
                    }
                });
            }
        } 

        [SYNC_WITH_DB] ({transaction, dont_validate_current_saved_things, schema__args}) { 
            const schema__not_user_generated_props = schema_wrapper.get_not_user_generated_props();

            return Promise.resolve()
            .then(() => {
                if( dont_validate_current_saved_things ) return;
                validate.assert.correctness_and_completness_without_draft(this, get_validation_args(this));
            })
            .then(() => {
                const schema__props = schema_wrapper.get_props(this);
                const schema__interpolated_props = schema_wrapper.get_potentially_interpolated_props(this);
                const schema__props_graveyard = schema_wrapper.get_graveyard_props(this);
                return (
                    interpolate.aggregate_events(
                        this,
                        {
                            Thing,
                            transaction,
                            dont_validate_current_saved_things,
                            db_handle,
                            schema__props,
                            schema__interpolated_props,
                            schema__props_graveyard,
                        }
                    )
                );
            })
            .then(() => {
                if( dont_validate_current_saved_things ) return;
                validate.assert.correctness_and_completness_without_draft(this, get_validation_args(this));
            })
            .then(() => {
                const schema__props_spec = schema_wrapper.get_props_spec(this);
                const schema__options = schema_wrapper.get_options(this);
                return (
                    interpolate.compute_views(this, {Thing, transaction, schema__options, schema__props_spec})
                );
            })
            .then(() => {
                if( dont_validate_current_saved_things ) return;
                validate.assert.correctness_and_completness_without_draft(this, get_validation_args(this));
            })
            .then(() =>
                // provide up to date database to schema.js when calling `compute_values`
                // - e.g. computed property `preview` in schema needs updated thing.views
                db_interface.save_thing(this, {Thing, db_handle, transaction, schema__not_user_generated_props})
            )
            .then(() => {
                const schema__props__ordered = schema_wrapper.get_props_ordered(this);
                return (
                    interpolate.compute_values(
                        this,
                        {
                            Thing,
                            transaction,
                            schema__props__ordered,
                            schema__args: Object.assign({}, schema__args__addendum, schema__args),
                        }
                    )
                );
            })
            .then(() => {
                assert(this.history); // TODO move this in validation code
                validate.assert.correctness_and_completness_without_draft(this, get_validation_args(this));
            })
            .then(() =>
                db_interface.save_thing(this, {Thing, db_handle, transaction, schema__not_user_generated_props})
            )
            .then(() =>
                this
            );
        } 

        get is_private() { 
            return (
                schema_wrapper.type_is_private(this)
            );
        } 

        toString() { 
            return JSON.stringify(
                Object.assign({
                    draft: Object.assign({}, this.draft),
                }, this)
            , null, 2);
        } 

        recompute({dont_cascade_saving, dont_apply_side_effects, remove_non_schema_props, skip_non_schema_types, transaction, schema__args}={}) { 
            if( Object.keys(this.draft).length !== 0 ) {
                throw new Error('recompute is only allowed with an empty draft');
            }

            // TODO - should be handled after upsert resolution
            if( skip_non_schema_types || remove_non_schema_props ) {
                const schema__props = schema_wrapper.get_props(this);
                if( skip_non_schema_types ) {
                    if( ! schema__props ) {
                        return Promise.resolve();
                    }
                }
                if( remove_non_schema_props ) {
                    assert_hard(schema__props, this, this.type);
                    for(const prop in this) {
                        if( !schema__props.includes(prop) ) {
                            delete this[prop];
                        }
                    }
                }
            }

            return save_thing_draft(
                this,
                {
                    save_on_empty_draft: true,
                    dont_validate_current_saved_things: true,
                    dont_cascade_saving,
                    dont_apply_side_effects,
                    schema__args,
                    transaction,
                }
            );
        } 

        static recompute_all(props) { 

            return (
                Thing.database.load.things(props, {result_fields: ['id']})
            )
            .then(things => {
                const to_recompute = {};
                things.forEach(t => to_recompute[t.id] = true);

                print_progress();

                return (
                    Promise_serial(
                        things
                        .map(t => () => {
                            if( ! to_recompute[t.id] ) {
                                return Promise.resolve();
                            }
                            return (
                                t.recompute()
                            )
                            .then(things__recomputed => {
                                things__recomputed
                                .forEach(t => {delete to_recompute[t.id]});
                                print_progress();
                            });
                        })
                    )
                    .then(() => {
                        clearLine();
                    })
                )

                function print_progress() {
                    const done = things.length - Object.keys(to_recompute).length;
                    const total = things.length;
                    const msg = (done===0?'\n':'')+done+'/'+total+' recomputed';
                    clearLine();
                    process.stdout.write(msg);
                }
            })
            .then(() => {});

            function clearLine() {
                const readline = require('readline');
                readline.clearLine(process.stdout);
                readline.cursorTo(process.stdout, 0);
            }
        } 
    }

    Thing.database = (() => { 
        return (
            {
                management: {
                    delete_tables: ensure_conn(delete_tables),
                    purge_everything: ensure_conn(purge_everything),
                    migrate: {
                        recompute_things: ensure_conn(add_statefull_args(migrate.recompute_things)),
                        events: ensure_conn(add_statefull_args(migrate.events)),
                        rename_column: ensure_conn(add_statefull_args(migrate.rename_column)),
                    },
                },
                close_connections,
                load: {
                    load_things_by_props: ensure_conn(process_result(load_things_by_props)),
                    things: ensure_conn(old_output(process_result(load_things_by_props))),
                    all_things: ensure_conn(old_output(process_result(all_things))),
                    view: ensure_conn(old_output(process_result(view))),

                },
            }
        );

        function delete_tables() { 
            return (
                (
                    db_interface.table.delete_all({Thing, db_handle})
                ).then(() => {
                    unique_constraints_installed = false;
                })
            );
        } 

        function purge_everything() { 
            return (
                (
                    Thing.database.management.delete_tables()
                ).then(() =>
                    db_interface.table.create_schema({Thing, db_handle})
                )
            );
        } 

        function close_connections() { 
            if( !db_handle ) {
                return Promise.resolve();
            }
            return Promise.all([
                db_handle.destroy(),
                require('../../util/long_term_cache').close_connection(),
            ]);
        } 

        function load_things_by_props(thing_props) { 
            assert( thing_props );
            assert( Object.keys(thing_props).length>0 && thing_props.length===undefined );
            assert( thing_props.draft === undefined && thing_props.propertyIsEnumerable('draft') === false );

            validate.load_props(thing_props, {Thing, type_is_optional: true});

            return (
                _plugins.run_plugs({
                    plugs: _plugins.all_plugs.plugs_load_things,
                    args: arguments,
                })
            );
        } 

        function all_things() { 
            assert(arguments.length === 0);
            return (
                db_interface.load_things({}, {Thing, db_handle})
            );
        } 

        function view(things_props, args={}) { 
            if( !things_props ) {
                throw new Error('Thing.database.load.view requires property filter argument');
            }
            if( things_props.constructor !== Array ) {
                throw new Error('Thing.database.load.view requires the property filter argument to be an array');
            }
            assert(args.constructor === Object);
            things_props.forEach(thing_props => {
                validate.load_props(thing_props, {Thing});
            });
            args.Thing = Thing;
            args.db_handle = db_handle;
            return (
                db_interface.load_view(things_props, args)
            );
        } 

        function process_result(fct) { 
            return (
                function() {
                    return (
                        _plugins.run_plugs({
                            plugs: _plugins.all_plugs.plugs_thing_collection,
                            root_plug: () => {
                                return (
                                    (
                                        fct.apply(this, arguments)
                                    )
                                    .then(output => {
                                        assert(output);

                                        output = turn_things_into_output(output);

                                        timerlog({ 
                                            id: 'slow_construct_things',
                                            tag: 'slowiness_tracker',
                                            measured_time_threshold: 1000,
                                            start_timer: true,
                                        }); 
                                        timerlog({ 
                                            id: 'construct_things',
                                            tags: ['performance', 'db_processing'],
                                            start_timer: true,
                                        }); 

                                        {
                                            if( output.plugin_memory_cache ) {
                                                assert(output.plugin_memory_cache.things_matched__hash);
                                                output.things_matched = memoize({
                                                    memory_cluster: 'construct_things',
                                                    cache_key: output.plugin_memory_cache.things_matched__hash,
                                                    computation,
                                                }).content;
                                            } else {
                                                output.things_matched = computation();
                                            }

                                            function computation() {
                                                return output.things_matched.map(thing_info => new Thing(thing_info))
                                            }
                                        }

                                        timerlog({ 
                                            id: 'construct_things',
                                            end_timer: true,
                                        }); 
                                        timerlog({ 
                                            id: 'slow_construct_things',
                                            end_timer: true,
                                        }); 

                                        return output;
                                    })
                                );
                            },
                        })
                    );
                }
            );
        } 

        function add_statefull_args(fct) { 
            return function(arg_obj={}) {
                arg_obj.Thing = Thing;
                arg_obj.db_handle = db_handle;
                arg_obj.schema__args = Object.assign({}, schema__args__addendum, arg_obj.schema__args);
                return fct(arg_obj);
            };
        } 

        function ensure_conn(fct) { 
            return (
                function() {
                    return (
                        (
                            ensure_connection(connection)
                        )
                        .then(() => {
                            assert(db_handle);
                        })
                        .then(() =>
                            fct.apply(this, arguments)
                        )
                    );
                }
            );
        } 
        function old_output(fct) { 
            return (
                function() {
                    return (
                        fct.apply(this, arguments)
                        .then(output => old_output_format(output))
                    );
                }
            );
        } 
    })(); 

    class SchemaError extends Error { constructor(m) { super(/*'SchemaError: '+*/m); } };
    class ValidationError extends Error { constructor(m) { super(/*'ValidationError: '+*/m); } };

    const Draft = (() => { 
        const THING = Symbol();
        class Draft {
            constructor(thing) {
                assert(thing);
                this[THING] = thing;
            }
            save_draft(args={}) {
                args.new_output_format = true;
                return this.save.call(this, args).then(o => {assert(o); return o});
            }
            save({transaction, new_output_format, dont_apply_side_effects, schema__args}={}) {
                assert(this[THING].constructor === Thing);
                assert(this[THING].draft === this);
                assert_soft(!transaction);
                return save_thing_draft(this[THING], {new_output_format, dont_apply_side_effects, schema__args});
            }
        }
        return Draft;
    })(); 

    const save_thing_draft = (() => { 
        const FAILED = Symbol();
        let sequential_retry_chain = Promise.resolve();
        const plugin_args = {};
        return (
            (
                thing,
                {
                    save_on_empty_draft=true,
                    dont_validate_current_saved_things=false,
                    dont_cascade_saving,
                    dont_apply_side_effects,
                    schema__args={},
                    new_output_format,
                    transaction,
                }={}
            ) => {

                const transaction__is_from_parent = !!transaction;

                const draft = thing.draft;

                assert(thing.constructor === Thing);
                let updated_things = [thing];
                let output_;

                const source = {
                    thing: clone_object(thing),
                    draft: clone_object(draft),
                };

                let draft_size;

                return (
                    Promise.resolve()
                    .then(() =>
                        ensure_connection(connection)
                    )
                    .then(() => {
                        return ensure_unique_constraints();
                    })
                    .then(() => {
                        if( transaction ) {
                            return;
                        }
                        return (
                            db_interface
                            .create_transaction({Thing, db_handle})
                            .then(t => transaction=t)
                        );
                    })
                    .catch(handle_pg_error__unexpected)
                    .then(() => thing[LOAD_ME]({transaction, schema__args}) )
                    // not sure why serialization fails already here
                    .catch(handle_pg_error__possible)
                    .then(() => {
                        plugin_args.thing_props_initial = clone_object(thing);
                    })
                    .then(() => {
                        const draft_keys = Object.keys(draft);
                        draft_size = draft_keys.length - (draft_keys.includes('author') ? 1 : 0);
                    })
                    .then(() => {
                        if( dont_validate_current_saved_things ) {
                            return;
                        }
                        validate.correctness(thing, get_validation_args(thing));
                    })
                    .then(() => {
                        const schema__props__ordered = schema_wrapper.get_props_ordered(thing);
                        return interpolate.apply_defaults(thing, {schema__props__ordered});
                    })
                    .then(() => {
                        if( dont_validate_current_saved_things ) {
                            return;
                        }
                        if( draft_size===0 ) {
                            validate.correctness_and_completness_without_draft(thing, get_validation_args(thing));
                        }
                        else {
                            validate.correctness_and_completness_with_draft(thing, get_validation_args(thing));
                        }
                    })
                    .then(() => {
                        if( draft_size===0 && ! save_on_empty_draft ) {
                            return commit_transaction();
                        }

                        return (
                            Promise.resolve()
                            .then(() =>
                                Promise.resolve()
                                .then(() => {
                                    if( draft_size === 0 ) {
                                        return;
                                    }
                                    assert(draft_size>0);

                                    const schema__props = schema_wrapper.get_props(thing);
                                    const schema__interpolated_props = schema_wrapper.get_interpolated_props(thing);
                                    assert(thing.id);
                                    return (
                                        db_interface
                                        .save_event(
                                            thing.id,
                                            thing.type,
                                            Object.assign({}, draft),
                                            {Thing, db_handle, transaction, schema__props, schema__interpolated_props}
                                        )
                                        .catch(handle_pg_error__possible)
                                        .then(new_values => {
                                            assert((new_values||0).constructor === Object);
                                            if( new_values !== null ) {
                                                assert( new_values.type === thing.type );
                                                delete new_values.type;
                                                assert(
                                                    deep_equal(new_values, Object.assign({}, thing.draft)),
                                                    [
                                                        'Unexpected un-equal objects:',
                                                        JSON.stringify(new_values, null, 2),
                                                        JSON.stringify(thing.draft, null, 2),
                                                    ].join('\n')
                                                );
                                                Object.assign(thing, new_values);
                                            }
                                        })
                                    );
                                })
                                .then(() => {
                                    plugin_args.draft_props = clone_object(thing.draft);
                                })
                                .then(() => {
                                    for(var i in draft) delete draft[i];
                                    assert(Object.keys(draft).length === 0);
                                })
                            )
                            .then(() => {
                                if( dont_validate_current_saved_things ) {
                                    return;
                                }
                                validate.assert.correctness_and_completness_without_draft(thing, get_validation_args(thing));
                            })
                            .catch(handle_pg_error__unexpected)
                            .then(() => thing[SYNC_WITH_DB]({transaction, dont_validate_current_saved_things, schema__args}) )
                            .then(() => do_cascade(thing, {Thing, transaction, dont_cascade_saving, dont_validate_current_saved_things, schema__args}) )
                            .catch(handle_pg_error__possible)
                            .then(things_referred => {
                                updated_things = [...updated_things, ...things_referred];
                            })
                            .catch(handle_pg_error__unexpected)
                            .then(() => {
                                if( !dont_apply_side_effects ) {
                                    const schema__options = schema_wrapper.get_options(thing);
                                    return (
                                        interpolate.apply_side_effects(
                                            thing,
                                            {
                                                Thing,
                                                transaction,
                                                schema__options,
                                                schema__args: Object.assign({}, schema__args__addendum, schema__args),
                                                is_within_transaction: true,
                                            }
                                        )
                                        .catch(handle_pg_error__possible)
                                    );
                                }
                            })
                            .then(() => commit_transaction().catch(handle_pg_error__expected))
                            .catch(handle_pg_error__unexpected)
                            .then(() => {
                                if( !dont_apply_side_effects ) {
                                    const schema__options = schema_wrapper.get_options(thing);
                                    return (
                                        interpolate.apply_side_effects(
                                            thing,
                                            {
                                                Thing,
                                                schema__options,
                                                schema__args: Object.assign({}, schema__args__addendum, schema__args),
                                                is_within_transaction: false,
                                            }
                                        )
                                        .catch(handle_pg_error__possible)
                                    );
                                }
                            })
                            .finally(() => {
                                rollback_transaction();
                            })
                            .catch(handle_pg_error__unexpected)
                        );

                    })
                    .finally(() => {
                        rollback_transaction();
                    })
                    .catch(handle_pg_error__unexpected)
                    .then(() => {
                        plugin_args.updated_things = updated_things;
                     // plugin_args.transaction = transaction;
                        return (
                            _plugins.run_plugs({
                                plugs: _plugins.all_plugs.plugs_save_thing,
                                args: [plugin_args],
                            })
                        );
                    })
                    .then(() =>
                        _plugins.run_plugs({
                            plugs: _plugins.all_plugs.plugs_thing_collection,
                            root_plug: () => {
                                let output = updated_things;
                                assert(output);
                                output = turn_things_into_output(output);
                                return Promise.resolve(output);
                            },
                        })
                    )
                    .then(output =>
                        new_output_format ? output : old_output_format(output)
                    )
                    .catch(err => {
                        if( err[IS_TIMING_ERROR] ) {
                            return retry_saving();
                        }
                        throw err;
                    })
                    .then(output => {assert(output); return output})
                );

                assert(false);

                function retry_saving() { 
                    // TODO; re-commit instead of this code?

                    Object.defineProperty(thing, FAILED, {value: (thing[FAILED]||0)+1, writable: true});
                    assert(thing.propertyIsEnumerable(FAILED) === false);

                    if( thing[FAILED] !== 1 ) {
                        return do_retry();
                    }

                    // The purpose of `sequential_retry_chain` is to run retries of several things sequentially.
                    // In order to avoid concurent saves to clash over and over again.
                    sequential_retry_chain = sequential_retry_chain.then(() => {
                        return do_retry();
                    });
                    return sequential_retry_chain;

                    function do_retry() {

                        return do_it_with_delay();

                        function do_it_with_delay() {
                            return new Promise(resolve => {
                                setTimeout(
                                    () => {
                                        resolve(do_it());
                                    },
                                    // - delay doesn't seem to decrease number of retries
                                    // - which is unexpected and I don't know why
                                    // Math.random()*700
                                    0
                                );
                            });
                        }

                        function do_it() {
                            // not using constructor `new Thing` because of
                            // - constructor logic
                            // - we need to keep same id

                            delete_props(thing);
                            for(var prop in draft) delete draft[prop];
                            Object.assign(thing, clone_object(source.thing));
                            Object.assign(draft, clone_object(source.draft));
                            if( new_output_format ) {
                                return thing.draft.save_draft();
                            } else {
                                return thing.draft.save();
                            }
                        }
                    }
                } 

                function handle_pg_error__unexpected(err) { 

                    if( ! could_be_pg_error(err) ) {
                        throw err;
                    }

                    assert_soft(false, err);

                    const pg_err = get_expected_pg_error(err);

                    if( pg_err.constraint_error || pg_err.is_timing_error ) {
                        assert_soft(false);
                        handle_pg_error(pg_err, err);
                        assert(false);
                    }

                    throw err;
                } 

                function handle_pg_error__possible(err) { 
                    if( ! could_be_pg_error(err) ) {
                        throw err;
                    }
                    const pg_err = get_expected_pg_error(err);
                    handle_pg_error(pg_err, err);
                    assert(false);
                } 

                function handle_pg_error__expected(err) { 
                    const pg_err = get_expected_pg_error(err);
                    handle_pg_error(pg_err, err);
                    assert(false);
                } 

                function handle_pg_error(pg_err, err) { 
                    assert_soft(pg_err.constraint_error || pg_err.is_timing_error, pg_err, err);

                    if( pg_err.constraint_error ) {
                        const constraint_info = db_interface.table.thingdb_schema_unique_constraints.constraints[pg_err.constraint_error];

                        if( ! constraint_info ) {
                            assert_soft(false, err);
                            constraint_info = {tuple: []};
                        } else {
                            assert_soft(constraint_info.type === thing.type, err);
                        }

                        const msg =
                            [
                                'Thing with type `'+thing.type+'` and '
                                    + constraint_info.tuple.map(prop => prop+' `'+thing[prop]+'`').join(' and ')
                                    +' already exists in database',
                                thing.toString(),
                                'Original save request:',
                                'Thing '+JSON.stringify(source.thing, null, 2),
                                'Draft '+JSON.stringify(source.draft, null, 2),
                            ].join('\n')

                        throw new Thing.ValidationError(msg);
                    }

                    throw ({[IS_TIMING_ERROR]: true});
                } 

                function get_expected_pg_error(err) { 

                    const is_pg_error = could_be_pg_error(err);
                    if( !is_pg_error ) {
                        throw err;
                    }

                    if( ! could_be_pg_error(err) ) {
                        return {};
                    }

                    assert_soft(err.code !== '23P01' || err.constraint);
                    const constraint_error = err.code === '23P01' && err.constraint;

                    const is_timing_error = (() => {
                        const COULD_NOT_SERIALIZE = err.code === '40001';
                        const DEAD_LOCK = err.code === '40P01';
                        const EVENT_CREATED_AT_NOT_UNIQUE = err.code === '23505' && err.constraint === 'thing_event_created_at_unique';
                        return (
                            [
                                COULD_NOT_SERIALIZE,
                                // not sure why deadlock can happen since we use pg's serialize feature
                                DEAD_LOCK,
                                EVENT_CREATED_AT_NOT_UNIQUE,
                            ].some(Boolean)
                        );
                    })();

                    assert_soft( !is_timing_error || !constraint_error );

                    return {
                        is_timing_error,
                        constraint_error,
                    };

                } 

                function could_be_pg_error(err) { 
                    return (
                        err && err.code
                    );
                } 

                function commit_transaction() { 
                    assert_soft(transaction);
                    if( ! transaction ) {
                        return;
                    }
                    if( transaction__is_from_parent ) {
                        return;
                    }

                    return (
                        transaction
                        .commit_promise()
                    );
                } 

                function rollback_transaction() { 
                 // assert_soft(transaction);
                    if( ! transaction ) {
                        return;
                    }
                    if( transaction__is_from_parent ) {
                        return;
                    }

                    return (
                        transaction
                        .rollback_promise()
                    );
                } 

                function clone_object(obj) { 
                    const obj_cloned = JSON.parse(JSON.stringify(obj));
                    assert_soft(deep_equal(obj_cloned, obj), JSON.stringify(obj_cloned), JSON.stringify(obj));
                    return obj_cloned;
                } 
            }
        ); 
    })(); 

    Thing.debug = {
        get_things_sync: () => debug.get_things_sync(Thing),
        log: debug.log,
    };

    Thing.SchemaError = SchemaError;
    Thing.ValidationError = ValidationError;

    // TODO - get rid of
    Thing.http_max_delay = http_max_delay;
    Thing.dont_throw_on_connection_errors = dont_throw_on_connection_errors;

    const schema_wrapper = new SchemaWrapper(schema, Thing.SchemaError, Thing.ValidationError);

    return Thing;

    function ensure_unique_constraints () { 
        if( ! unique_constraints_installed ) {
            const unique_props = schema_wrapper.get_unique_props();
            unique_constraints_installed = (
                db_interface.table.thingdb_schema_unique_constraints.apply({unique_props, db_handle})
            );
        }
        return unique_constraints_installed;
    }; 

    function ensure_connection(connection) { 
        if( ! connection_established ) {
            connection_established = (
                db_interface.table.ensure_database_connection(connection)
                .then(({handle, database_newly_created}) => {
                    db_handle = handle;
                    // TODO - get rid of
                    Thing.db_handle = db_handle;
                    if( database_newly_created ) {
                        return db_interface.table.create_schema({Thing, db_handle});
                    }
                })
            );
        }
        return connection_established;
    } 

    function get_validation_args(thing) { 
        const schema__props_spec = schema_wrapper.get_props_spec(thing);
        const schema__draft_props_spec = schema_wrapper.get_draft_props_spec(thing);
        const schema__options = schema_wrapper.get_options(thing);
        return {
            Thing,
            schema__props_spec,
            schema__draft_props_spec,
            schema__options,
        };
    } 

    function delete_props(thing) { 
        /*
        for(var prop in thing) {
            const dsr = Object.getOwnPropertyDescriptor(thing, prop);
            if( dsr.configurable===false ) {
                thing[prop] = undefined;
            } else {
                delete thing[prop];
            }
        }
        */
        thing[_delete_id]();
        for(var prop in thing) {
            delete thing[prop];
        }
    } 

    function thing_assign(to, from) { 
        Object.getOwnPropertyNames(from)
        .forEach(prop => {
            if( prop === "draft" ) {
                return;
            }
            if( prop === "subtype" ) {
                return;
            }
            if( prop === "id" ) {
                to.id = from.id;
                return;
            }
            Object.defineProperty(
                to,
                prop,
                Object.getOwnPropertyDescriptor(from, prop)
            )
        });
    } 

    function old_output_format(output) { 
        assert(output.constructor===Object);
        assert(output.things_matched.constructor===Array);
        const things = output.things_matched;
        for(var key in output) {
            if( key !== 'things_matched' ) {
                things[key] = output[key];
            }
        }
        return things;
    } 

    function turn_things_into_output(output) { 
        assert([Array, Object].includes(output.constructor));
        if(output.constructor === Array ) {
            output = {things_matched: output};
        }
        Object.assign(output, {is_private});
        assert(output.things_matched.constructor===Array);
        return output;

        function is_private () { 
            timerlog({ 
                id: 'compute_is_private',
                tags: ['performance', 'db_processing'],
                start_timer: true,
            }); 

            const is_it = output.things_matched.some(thing => thing.is_private);

            timerlog({ 
                id: 'compute_is_private',
                end_timer: true,
            }); 

            return is_it;
        } 
    } 

    function do_cascade(thing, {Thing, transaction, dont_cascade_saving, dont_validate_current_saved_things, transitive_mode, schema__args}) { 
        // we also need to update the `view` interpolated property of certain referred things
        // - e.g. we need this when tagging a resource -> the tag needs to be inserted into the `view` property of the resource
        if( dont_cascade_saving ) {
            return Promise.resolve([]);
        }
        let updated_things = [];

        return (
            Promise.all(
                get_ids_to_cascade()
                .map(({id}) => {
                    assert( transaction && transaction.rid );
                    return (
                        Thing.database.load.things({id}, {transaction})
                    )
                    .then(things => {
                        assert(things.length === 1, things);
                        return things[0];
                    })
                    .then(thing_referred =>
                        thing_referred[SYNC_WITH_DB]({transaction, dont_validate_current_saved_things, schema__args})
                    )
                    .then(thing_referred => {
                        updated_things.push(thing_referred);
                        return thing_referred;
                    })
                    .then(thing_referred =>
                        do_cascade(thing_referred, {Thing, transaction, dont_validate_current_saved_things, transitive_mode: true, schema__args})
                        .then(updated_things__rec => {
                            updated_things = [...updated_things, ...updated_things__rec];
                        })
                    )
                })
            )
            .then(() => {
                assert(updated_things.every(t => !!t.type));
                return updated_things;
            })
        );

        function get_ids_to_cascade() {
            return (
                schema_wrapper.get_cascade_props(thing)
                .filter(({transitive_cascade}) => !transitive_mode || !!transitive_cascade)
                .map(({prop}) => ({id: thing[prop]}))
                .filter(({id}) => !!id)
            );
        }
    } 
}

const SchemaWrapper = (() => { 
    const get_schema_for_type = Symbol();
    const schema_flattened = Symbol();
    const get_subtype_name = Symbol();
    const private_types = Symbol();
    const schema_options = Symbol();

    class SchemaWrapper {
        constructor(schema, _SchemaError, _ValidationError) { 
            deepFreeze(schema);
            deepFreeze(schema_common);

            const _schema = {};
            const _schema_draft = {};
            const _schema_options = {};
            Object.entries(schema)
            .forEach(([type, type_spec]) => {
                if( type==='_options' ) {
                    Object.assign(_schema_options, type_spec);
                    return;
                }
                assert(schema_common.thing._options===undefined);
                assert(schema_common.draft._options===undefined);
                _schema[type] = Object.assign({}, schema_common.thing, type_spec);
                _schema_draft[type] = Object.assign({}, schema_common.draft, type_spec);

                [_schema[type], _schema_draft[type]].forEach(sc => {
                    sc._options = sc._options || {};
                    Object.entries(sc)
                    .forEach(([key, value]) => {
                        if( ! key.startsWith('_') ) {
                            return;
                        }
                        assert(['_options', '_subtypes'].includes(key));
                        Object.defineProperty(sc, key, {value, enumerable: false});
                    });
                });
            });

            deepFreeze(_schema);
            deepFreeze(_schema_draft);

            this[get_schema_for_type] = type_schema_retriever({_schema, _schema_draft, _SchemaError, _ValidationError});
            this[schema_flattened] = get_flattened_schema({_schema});
            this[get_subtype_name] = thing => find_matching_subtype({thing, _schema: _schema[thing.type], _SchemaError, _ValidationError});
            this[private_types] = get_private_types({_schema, _SchemaError});
            this[schema_options] = _schema_options;

            deepFreeze(this);

            return this;
        } 

        get_non_enumerable_props() { 
            return (
                get_props_with_option('is_non_enumerable')
            );
        } 

        get_not_user_generated_props() { 
            return (
                get_props_with_option('is_not_user_generated')
            );
        } 

        get_unique_props() { 
            const unique_props = [];
            this[schema_flattened].forEach(({type, _options, property, spec}) => {
                assert( type );
                assert( !!property === !_options );
                assert( !!property === !!spec );

                if( _options ) {
                    const is_unique = _options.is_unique;
                    assert( is_unique===undefined || is_unique.constructor === Array );
                    if( is_unique ) {
                        assert( is_unique.length > 0 );
                        const tuple = is_unique;
                        unique_props.push({
                            type,
                            tuple,
                        });
                    }
                }

                if( property ) {
                    assert( ! property.startsWith('_') );
                    assert( spec.is_unique === undefined || spec.is_unique.constructor === Boolean );

                    if( spec.is_unique ) {
                        const tuple = [property];
                        unique_props.push({
                            type,
                            tuple,
                        });
                    }
                }
            });
            return unique_props;
        } 

        get_props_ordered(thing) { 
            assert(thing);
            const sc = this[get_schema_for_type](thing);
            assert(sc);
            let specs = (() => {
                const specs = [];
                Object.entries(sc)
                .forEach(([property, property_spec]) => {
                    specs.push(
                        Object.assign(
                            {property},
                            property_spec
                        )
                    );
                })
                return specs;
            })();

            specs = specs.sort((spec1, spec2) => {
                // compute_order: -1 -> always last
                // compute_order: 1 -> always first
                const order1 = spec1.compute_order||0;
                const order2 = spec2.compute_order||0;
                if( order1 === 0 ) {
                    return order2;
                }
                if( order1 < 0 ) {
                    if( order2 >= 0 )
                        return 1;
                    if( order2 < 0 )
                        return order1 - order2;
                    assert(false);
                }
                if( order1 > 0 ){
                    if( order2 >= 0 )
                        return -1;
                    if( order2 >= 0 )
                        return order2 - order1;
                    assert(false);
                }
                assert(false);
            });

            return specs;
        } 

        prop_is_unique(thing, prop) { 
            const ret = (this.get_props_spec(thing)[prop]||{}).is_unique;
            assert(prop!=='type' || !ret);
            return ret;
        } 

        prop_is_part_of_unique_set(thing, prop) { 
            const ret = (this.get_options(thing).is_unique||[]).includes(prop);
            assert(prop!=='type' || !ret);
            return ret;
        } 

        type_is_private(thing) { 
            const type = thing.type;
            if( !type ) {
                // we need the type to be able to determine whether data is private or not
                return true;
            }
         // return !!this.get_options(thing).is_private;
            // equivalent to above but faster
            return this[private_types].includes(type);
        } 

        get_options(thing) { 
            return (
                (this[get_schema_for_type](thing)||{})._options || {}
            );
        } 

        get_interpolated_props(thing) { 
            return (
                [
                    ...this.get_computed_props(thing),
                    'subtype',
                ]
            );
        } 

        get_potentially_interpolated_props(thing) { 
            return (
                [
                    ...this.get_interpolated_props(thing),
                    ...this.get_props_with_default_val(thing),
                ]
            );
        } 

        get_computed_props(thing) { 
            return (
                Object.entries(
                   this.get_props_spec(thing)
                )
                .map(([prop_name, {value}]) => value!==undefined && prop_name)
                .filter(Boolean)
            );
        } 

        get_props_with_default_val(thing) { 
            return (
                Object.entries(
                   this.get_props_spec(thing)
                )
                .map(([prop_name, {default_value}]) => default_value!==undefined && prop_name)
                .filter(Boolean)
            );
        } 

        get_default_value(thing, prop) { 
            const sc = this.get_props_spec(thing);
            const spec = sc[prop];
            assert_soft(spec);
            assert_soft(spec.default_value!==undefined);
        } 

        get_cascade_props(thing) { 
            return (
                Object.entries(
                   this.get_props_spec(thing)
                )
                .map(([prop, {cascade_save}]) => cascade_save && ({
                    transitive_cascade: cascade_save.transitive_cascade,
                    prop,
                }))
                .filter(Boolean)
            );
        } 

        get_props(thing) { 
            const _spec = this.get_props_spec(thing);
            return (
                _spec && Object.keys(_spec) || _spec
            );
        } 

        get_subtype_name(thing) { 
            return (
                this[get_subtype_name](thing)
            );
        } 

        get_props_spec(thing) { 
            return (
                only_props(this[get_schema_for_type](thing))
            );
        } 

        get_draft_props_spec(thing) { 
            return (
                only_props(this[get_schema_for_type](thing, {return_draft_schema: true}))
            );
        } 

        get_graveyard_props(thing) { 
            return (
                this[get_schema_for_type](thing)._options.graveyard || []
            );
        } 

        get_graveyard_types() { 
            return (
                this[schema_options].graveyard || []
            );
        } 
    }

    return SchemaWrapper;

    function get_flattened_schema({_schema}) { 
        const schema_flattened = [];
        Object.entries(_schema)
        .forEach(([type, spec_type]) => {
            if( spec_type._subtypes ) {
                Object.entries(spec_type._subtypes)
                .forEach(([subtype, spec_subtype]) => {
                    assert(!spec_subtype._options);
                    Object.entries(spec_subtype)
                    .forEach(([property, spec_property]) => {
                        schema_flattened.push({
                            type,
                            property,
                            subtype,
                            spec: spec_property,
                        });
                    })
                });
            }
            schema_flattened.push({
                type,
                _options: spec_type._options,
            });
            Object.entries(spec_type)
            .forEach(([property, spec_property]) => {
                assert(!property.startsWith('_'));
                schema_flattened.push({
                    type,
                    property,
                    spec: spec_property,
                });
            });
        });
        deepFreeze(schema_flattened);
        return schema_flattened;
    } 

    function type_schema_retriever({_schema, _schema_draft, _SchemaError, _ValidationError}) { 
        return (
            (thing, {return_draft_schema=false}={}) => {
                assert(thing.type);

                const sc = (return_draft_schema ? _schema_draft : _schema);
                const sct = sc[thing.type];

                if( ! sct ) {
                    return sct;
                }

                const schema_for_type = (() => {
                    const schema_for_type = {};

                    deepAssign(schema_for_type, sct);
                    assert(sct._options);
                    Object.defineProperty(schema_for_type, '_options', {value: sct._options});

                    if( sct._subtypes ) {
                        const thing_schema = _schema[thing.type];
                        assert(thing_schema._subtypes);
                        const subtype = find_matching_subtype({thing, _schema: thing_schema, _SchemaError, _ValidationError});
                        assert(subtype);
                        deepAssign(schema_for_type, sct._subtypes[subtype]);
                    }

                    return schema_for_type;
                })();

                assert(schema_for_type._options);
                assert(!schema_for_type._subtypes);
                return schema_for_type;
            }
        );
    } 

    function find_matching_subtype({thing, _schema, _SchemaError, _ValidationError}) { 
        if(!(_schema||{})._subtypes) {
            return;
        }

        const thing_props = Array.from(new Set([
            ...Object.keys(thing),
            ...Object.keys(thing.draft),
        ]));

        const sub_candidates = (
            Object.entries(_schema._subtypes)
            .filter(([subtype_name, subtype_schema]) => {

                const all_thing_props_are_defined = (
                    thing_props
                    .every(prop => _schema[prop] || subtype_schema[prop])
                );
                assert(_schema['type']);
                assert(_schema['created_at']);
                if( ! all_thing_props_are_defined ) {
                    return false;
                }

                // above is not enough because of `tag` subtypes `tag_markdown_list_raw` and `tag_markdown_list_github`
                const has_all_required_props = (
                    Object.entries(subtype_schema)
                    .every(([prop, prop_spec]) => {
                        const is_required = (() => { 
                            assert(_schema._options);
                            if( prop_spec.is_required ) {
                                return true;
                            }
                            const opts = (
                                Object.assign(
                                    {},
                                    _schema._options,
                                    subtype_schema._options
                                )
                            );
                            if( (opts.is_required||[]).includes(prop) ) {
                                return true;
                            }
                            return false;
                        })(); 
                        if( ! is_required ) {
                            return true;
                        }
                        return thing_props.includes(prop);
                    })
                );
                if( has_all_required_props ) {
                    return true;
                }

                // is not redundant to `all_thing_props_are_defined`
                const defines_a_subtype_specific_prop = (
                    thing_props.some(prop => {
                        if( _schema[prop] ) {
                            return false;
                        }
                        const prop_is_defined_in_another_subtype = (
                            Object.entries(_schema._subtypes)
                            .filter(([subtype_name__other]) => subtype_name__other!==subtype_name)
                            .some(([_, subtype_schema__other]) => subtype_schema__other[prop])
                        );
                        if( prop_is_defined_in_another_subtype ) {
                            return false;
                        }
                        return true;
                    })
                );
                if( defines_a_subtype_specific_prop ) {
                    return true;
                }

                return false;
            })
            .map(([subtype_name, subtype_schema]) => {
                return ({
                    subtype_name,
                    subtype_schema,
                });
            })
            /*
            .map(({subtype_name, subtype_schema}) => {
                return ({
                    subtype_name,
                    subtype_schema,
                    number_of_matching_props: (
                        thing_props
                        .filter(prop => !_schema[prop])
                        .filter(prop => !!subtype_schema[prop])
                        .length
                    ),
                });
            })
            .sort((m1, m2) => m2.number_of_matching_props - m1.number_of_matching_props)
            */
        );

        if( sub_candidates.length>1
         // && sub_candidates[0].number_of_matching_props === sub_candidates[1].number_of_matching_props
        ) {
            throw new _ValidationError(
                [
                    "Following thing can't be in several subtypes",
                    thing.toString(),
                    "Subtypes:",
                    ...sub_candidates.map(st => JSON.stringify(st, null, 2)),
                ].join('\n')
            );
        }

        if( !sub_candidates[0] ) {
            throw new _ValidationError(
                [
                    "Couldn't find subtype for following thing",
                    thing.toString(),
                ].join('\n')
            );
        }

        let sub = sub_candidates[0].subtype_name;

        return sub;
    } 

    function only_props(schema_) { 
        if( !schema_ ) {
            return schema_;
        }
        const schema__props = {};
        Object.entries(
            schema_
        )
        .forEach(([prop_name, prop_spec]) => {
            if( prop_name.startsWith('_') ) {
                return;
            }
            schema__props[prop_name] = prop_spec;
        })
        return schema__props;
    } 

    function get_private_types({_schema, _SchemaError}) { 
        const ret = [];
        Object.entries(_schema)
        .forEach(([type, type_spec]) => {
            if( type_spec._options.is_private ) {
                return ret.push(type);
            }
            Object.values(
                (type_spec._subtypes||{})
            )
            .forEach(subtype_spec => {
                if( (subtype_spec._options||{}).is_private ) {
                    throw new _SchemaError("`is_private` option not supported on subtypes");
                }
            });
        });
        return ret;
    } 

    function get_props_with_option(option/*, type*/) { 
        const non_enumerable_props = [];
        /* we can't determine the schema when only the ID is provided
        assert(type);
        const props_spec = (
            this[schema_flattened]
            .filter(p => p.type===type)
            .filter(p => p.spec)
            .map(({property, spec}) => ({
                property,
                spec
            }))
        );
        */
        const props_spec = (
            Object.entries(schema_common.thing)
            .filter(([property, spec]) => !property.startsWith('_'))
            .map(([property, spec]) => ({property, spec}))
        );
        props_spec.forEach(({property, spec}) => {
            if( spec[option] ) {
                non_enumerable_props.push(property);
            }
        });
        return non_enumerable_props;
    } 
})(); 

