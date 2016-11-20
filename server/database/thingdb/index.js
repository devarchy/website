"use strict";
require('babel-polyfill');
const assert = require('assert');
const db_interface = require('./database');
const migrate = require('./migrate');
const validate = require('./validate');
const interpolate = require('./interpolate');
const Promise = require('bluebird');
Promise.longStackTraces();
const uuid = require('node-uuid');
const debug = require('./debug');
const Promise_serial = require('promise-serial');
const knex_module = require('knex');


module.exports = class ThingDB {
    constructor({connection, schema, http_max_delay=null}) {
        {
            const error_suffix = " required when constructing a `"+this.constructor.name+"` instance";
            if( !connection ) {
                throw new Error("`connection`"+error_suffix);
            }
            if( !schema ) {
                throw new Error("`schema`"+error_suffix);
            }
        }

        const Thing = stateful_thing_class({connection, schema, migration_applied: false, http_max_delay});

        return Thing;
    }
};


function stateful_thing_class(state) {

    assert(Object.keys(state).length===4);
    assert(state.connection);
    assert(state.schema);
    assert(state.migration_applied===false);
    assert(state.http_max_delay!==undefined);

    const db_handle =
        knex_module({
            dialect: 'postgres',
            connection: state.connection,
        });

    const SAVE_TYPE = Symbol();
    const SAVE_TYPES = {
        IS_INSERT: Symbol(),
        IS_UPDATE: Symbol(),
        IS_UPSERT: Symbol(),
    };
    const LOAD_ME = Symbol();
    const SYNC_WITH_DB = Symbol();

    class Thing {
        constructor(props) { 
            if( ! props ) {
                throw new Error('object holding initial properties of thing is required when constructing a Thing');
            }

            const draft = props.draft;
            delete props.draft;
            Object.assign(this, props);

            Object.defineProperty(this, 'draft', {
                value: new Draft(this),
                enumarable: false,
                configurable: false,
                writable: false,
            });
            Object.assign(this.draft, draft);
            assert(this.propertyIsEnumerable('draft') === false);
            assert(this.draft.constructor === Draft);

            if( ! this.id && ! this.type ) {
                throw new Error('when constructing a Thing, `type` or `id` is required');
            }

            /* no easy way to catch errors thrown here in promise
            // TODO; use proxy once Node.js is using V8 4.9
            Object.observe(this, () => {validate.correctness(this); });
            */

            Object.defineProperty(this, SAVE_TYPE, {
                value: (() => {
                    if( this.id ) {
                        return SAVE_TYPES.IS_UPDATE;
                    }

                    assert(this.type);
                    if( Object.keys(this).length === 1 ) {
                        return SAVE_TYPES.IS_INSERT;
                    }

                    return SAVE_TYPES.IS_UPSERT;
                })(),
                writable: true,
            });
            assert(this.propertyIsEnumerable(SAVE_TYPE) === false);
            assert(Object.values(SAVE_TYPES).includes(this[SAVE_TYPE]));

            if( this[SAVE_TYPE] === SAVE_TYPES.IS_INSERT ) {
                assert(! this.id);
                this.id = uuid.v4();
            }

        } 

        /*
        get [SAVE_TYPE] () { 
            if( this.id ) {
                return SAVE_TYPES.IS_UPDATE;
            }

            assert(this.type);
            if( Object.keys(this).length === 1 ) {
                //assert(Object.keys(this.draft).length>0);
                return SAVE_TYPES.IS_INSERT;
            }

            return SAVE_TYPES.IS_UPSERT;
        } 
        */

        [LOAD_ME] (transaction) { 
            return Promise.resolve()
                .then(() => migrate_schema_unique_tuples())
                .then(() => {
                    if( this[SAVE_TYPE] === SAVE_TYPES.IS_INSERT ) {
                        return Promise.resolve();
                    }

                    if( this.id ) {
                        return load_thing_by_id.call(this);
                    }

                    if( this[SAVE_TYPE] === SAVE_TYPES.IS_UPSERT ) {
                        return resolve_upsert.call(this);
                    }

                    assert(false);
                })
                .then(() => {
                    assert(this.id);
                    assert(this[SAVE_TYPE] !== SAVE_TYPES.IS_UPSERT);
                    assert(this.propertyIsEnumerable(SAVE_TYPE) === false);
                });


            function load_thing_by_id() {
                assert( this.id );
                assert( this[SAVE_TYPE] !== SAVE_TYPES.IS_UPSERT );
                return (
                    Thing.database.load.things({id: this.id}, {transaction})
                )
                .then(things => {
                    assert( things.length === 1 );
                    if( this.type !== undefined && things[0].type !== this.type ) {
                        throw new Error("Thing with ID `"+this.id+"` is of type `"+things[0].type+"` and not `"+this.type+"`");
                    }
                    for(var prop in this) delete this[prop];
                    Object.assign(this, things[0]);
                })
            }

            function resolve_upsert() {
                assert( ! this.id );
                assert( this.type );
                assert( this[SAVE_TYPE] === SAVE_TYPES.IS_UPSERT );

                interpolate.compute_values(this, {Thing, only_sync: true, required_props_may_be_missing: true});

                const unique_prop_sets = (() => {
                    const unique_prop_sets = [];
                    const prop_set = {};
                    for(let prop in this) {
                        if( prop_is_unique(this.schema, prop) ) {
                            unique_prop_sets.push({
                                [prop]: this[prop],
                                type: this.type,
                            });
                        }
                        if( prop_is_part_of_unique_set(this.schema, prop) ) {
                            prop_set[prop] = this[prop];
                        }
                    }
                    if( Object.keys(prop_set).length>0 ) {
                        unique_prop_sets.push(Object.assign(prop_set, {type: this.type}));
                    }
                    return unique_prop_sets;
                })();
                assert(unique_prop_sets.length>0, 'unique key is missing in\n'+this);

                return Promise.all(
                    unique_prop_sets.map(props => Thing.database.load.things(props, {transaction}))
                )
                .then( array_of_things =>
                    array_of_things.reduce((acc, curr) => {
                        assert(curr.constructor===Array);
                        curr.forEach(thing => {
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

                    if( thing_in_db ) {
                        assert(
                            Object
                            .keys(this)
                            .some(prop => {
                                if( ! prop_is_unique(this.schema, prop) && ! prop_is_part_of_unique_set(this.schema, prop) ) {
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

                    for(var prop in this) {
                        if( ['type', 'id', 'author', ].includes(prop) ) {
                            continue;
                        }
                        if( thing_in_db && thing_in_db[prop] === this[prop] ) {
                            continue;
                        }
                        if( this.schema[prop].value ) {
                            continue;
                        }
                        this.draft[prop] = this[prop];
                        delete this[prop];
                    }

                    assert( !this.id || thing_in_db );
                    this.id = thing_in_db ? thing_in_db.id : uuid.v4();

                    const draft_is_empty = Object.keys(this.draft).length === 0;

                    assert( state.schema.user );
                    if( ! draft_is_empty ) {
                        this.draft.author = this.draft.author || this.author;
                        if( ! this.draft.author && this.type === 'user' ) {
                            this.draft['author'] = this.id;
                        }
                    }

                    if( thing_in_db ) {
                        assert( Object.assign({}, thing_in_db).draft === undefined );
                        Object.assign(this, thing_in_db);
                    }

                    this[SAVE_TYPE] = thing_in_db ? SAVE_TYPES.IS_UPDATE : SAVE_TYPES.IS_INSERT;
                });

                function prop_is_unique(type_schema, prop) {
                    const ret = (type_schema[prop]||{}).is_unique;
                    assert(prop!=='type' || !ret);
                    return ret;
                }
                function prop_is_part_of_unique_set(type_schema, prop) {
                    const ret = ((type_schema._options||{}).is_unique||[]).includes(prop);
                    assert(prop!=='type' || !ret);
                    return ret;
                }
            }
        } 

        [SYNC_WITH_DB] ({transaction, dont_validate_current_saved_things}) { 
            return Promise.resolve()
            .then(() => {
                if( dont_validate_current_saved_things ) {
                    return;
                }
                validate.assert.correctness_and_completness_without_draft(this, {Thing});
            })
            .then(() =>
                interpolate.aggregate_events(
                    this,
                    {
                        Thing,
                        is_insert: this[SAVE_TYPE]===SAVE_TYPES.IS_INSERT,
                        transaction,
                        dont_validate_current_saved_things,
                    }
                )
            )
            .then(() => {
                validate.assert.correctness_and_completness_without_draft(this, {Thing});
            })
            .then(() =>
                interpolate.compute_views(this, {Thing, transaction})
            )
            .then(() => {
                validate.assert.correctness_and_completness_without_draft(this, {Thing});
            })
            .then(() =>
                // provide up to date database to schema.js when calling `compute_values`
                // - e.g. computed property `preview` in schema needs updated thing.views
                db_interface.save.thing(this, {Thing, db_handle, transaction})
            )
            .then(() =>
                interpolate.compute_values(this, {Thing, transaction})
            )
            .then(() => {
                assert(this.history); // TODO move this in validation code
                validate.assert.correctness_and_completness_without_draft(this, {Thing});
            })
            .then(() =>
                db_interface.save.thing(this, {Thing, db_handle, transaction})
            )
            .then(() =>
                this
            );
        } 

        get schema() { 
            assert(state.schema);
            assert(this.type, this);
            const schema = state.schema[this.type];
            if( schema && schema._options ) {
                Object.defineProperty(schema, '_options', {value: schema._options, enumerable: false});
            }
            return schema;
        } 

        get schema_ordered() { 
            let specs = (() => {
                const specs = [];
                for(let prop in this.schema) {
                    specs.push(
                        Object.assign(
                            {property: prop},
                            this.schema[prop]
                        )
                    );
                }
                return specs;
            })();

            specs = specs.sort((spec1, spec2) => {
                // order: -1 -> always last
                // order: 1 -> always first
                const order1 = spec1.order||0;
                const order2 = spec2.order||0;
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

        get is_private() { 
            if( !this.type ) {
                // we need the type to be able to determine whether data is private or not
                return true;
            }
            return (
                (this.schema._options||{})
                .is_private
            );
        } 

        toString() { 
            return JSON.stringify(
                Object.assign({
                    draft: Object.assign({}, this.draft),
                }, this)
            , null, 2);
        } 

        recompute({dont_cascade_saving, dont_apply_side_effects}={}) { 
            if( Object.keys(this.draft).length !== 0 ) {
                throw new Error('recompute is only allowed with an empty draft');
            }
            return save_thing_draft(
                this,
                {
                    save_on_empty_draft: true,
                    dont_validate_current_saved_things: true,
                    dont_cascade_saving,
                    dont_apply_side_effects,
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

                return Promise_serial(
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

        static get schema() { 
            return (
                state.schema
            );
        } 
    }

    Thing.database = { 
        management: {
            delete_all: () => db_interface.table.delete_all({Thing, db_handle}),
            create_schema: () => db_interface.table.create_schema({Thing, db_handle}),
            migrate: (() => {
                return {
                    recompute_things: add_statefull_stuff(migrate.recompute_things),
                    events: add_statefull_stuff(migrate.events),
                };

                function add_statefull_stuff(fct) {
                    return function(arg_obj={}) {
                        assert(arguments.length===1);
                        arg_obj.Thing = Thing;
                        arg_obj.db_handle = db_handle;
                        return fct(arg_obj);
                    };
                }
            })(),
        },
        close_connections: () => {
            db_handle.destroy();
            require('../../util/long_term_cache').close_connection();
        },
        load: (() => {
            return {
                things,
                all_things,
                view,
            };

            function things(props, args={}) { 
                assert( props );
                assert( Object.keys(props).length>0 && props.length===undefined );
                assert( props.id || props.type );
                assert( props.draft === undefined && props.propertyIsEnumerable('draft') === false );
                assert( args.constructor === Object );
                args.Thing = Thing;
                args.db_handle = db_handle;
                return (
                    db_interface.load.things(props, args)
                )
                .then(process_result)
            } 

            function all_things() { 
                assert(arguments.length === 0);
                return (
                    db_interface.load.things({}, {Thing, db_handle})
                )
                .then(process_result)
            } 

            function view(props, args={}) { 
                if( !props ) {
                    throw new Error('Thing.database.load.view requires property filter argument');
                }
                if( props.constructor !== Array ) {
                    throw new Error('Thing.database.load.view requires the property filter argument to be an array');
                }
                assert(args.constructor === Object);
                args.Thing = Thing;
                args.db_handle = db_handle;
                return (
                    db_interface.load.view(props, args)
                )
                .then(process_result)
            } 

            function process_result(things) { 
                things = things.map(thing_info => new Thing(thing_info));
                things.is_private = things.some(thing => thing.is_private);
                return things;
            } 
        })(),
    }; 

    class SchemaError extends Error { constructor(m) { super(/*'SchemaError: '+*/m); } };
    class ValidationError extends Error { constructor(m) { super(/*'ValidationError: '+*/m); } };

    const Draft = (() => { 
        const THING = Symbol();
        class Draft {
            constructor(thing) {
                assert(thing);
                this[THING] = thing;
            }
            save({transaction}={}) {
                assert(this[THING].constructor === Thing);
                assert(this[THING].draft === this);
                return save_thing_draft(this[THING], {transaction});
            }
        }
        return Draft;
    })(); 

    const save_thing_draft = (() => { 
        const FAILED = Symbol();
        let sequential_retry_chain = Promise.resolve();
        return (thing, {save_on_empty_draft=true, transaction, dont_validate_current_saved_things=false, dont_cascade_saving, dont_apply_side_effects}) => { 

            const draft = thing.draft;

            let things_updated = [thing];

            const source = {
                thing: clone_object(thing),
                draft: clone_object(draft),
                thing_SAVE_TYPE: thing[SAVE_TYPE],
            };

            let draft_size = Object.keys(draft).length;

            return (
                Promise.resolve()
            )
            .then(() => migrate_schema_unique_tuples())
            .then(() => ! transaction && db_interface.transaction({Thing, db_handle}).then(t => transaction=t) )
            .then(() => thing[LOAD_ME](transaction) )
            .then(() => {
                // upsert resolution may populate draft
                const draft_size__now = Object.keys(draft).length;
                assert(draft_size__now >= draft_size, 'it does not make sense to remove parts of draft');
                draft_size = draft_size__now;
            })
            .then(() => {
                if( dont_validate_current_saved_things ) {
                    return;
                }
                if( draft_size===0 ) {
                    validate.correctness_and_completness_without_draft(thing, {Thing});
                }
                else {
                    validate.correctness_and_completness_with_draft(thing, {Thing});
                }
            })
            .then(() => {
                if( draft_size===0 && ! save_on_empty_draft ) {
                    return transaction.commit_promise();
                }

                return (
                    Promise.resolve()
                )
                .then(() => {
                    assert( ! draft.history );
                    if( draft_size > 0 ) {
                        return db_interface.save.event(thing.id, thing.type, Object.assign({}, draft), thing.schema, {Thing, db_handle, transaction})
                    }
                    return null;
                })
                .then(new_values => {
                    assert(draft_size > 0 || new_values===null);
                    assert(draft_size === 0 || (new_values||0).constructor === Object);
                    if( new_values !== null ) {
                        assert( new_values.type === thing.type );
                        delete new_values.type;
                        assert(deep_equal(new_values, Object.assign({}, thing.draft)));
                        Object.assign(thing, new_values);
                        for(var i in draft) delete draft[i];
                    }
                    assert(Object.keys(draft).length === 0);
                })
                .then(() => {
                    if( dont_validate_current_saved_things ) {
                        return;
                    }
                    validate.assert.correctness_and_completness_without_draft(thing, {Thing});
                })
                .then(() => thing[SYNC_WITH_DB]({transaction, dont_validate_current_saved_things}) )
                .then(() => update_referred_things() )
                .then(things_referred => {things_updated = things_updated.concat(things_referred)} )
                .then(() =>
                    transaction.commit_promise()
                    .catch(err => {
                        if( (err||{}).code === '23P01' &&
                            db_interface.table.thingdb_schema_unique_constraints.constraints[(err||{}).constraint] ) {
                            const constraint_info = db_interface.table.thingdb_schema_unique_constraints.constraints[err.constraint];
                            assert(constraint_info.type === thing.type);
                            throw new Thing.ValidationError([
                                'Thing with type `'+thing.type+'` and '
                                    + constraint_info.tuple.map(prop => prop+' `'+thing[prop]+'`').join(' and ')
                                    +' already exists in database',
                                thing.toString(),
                                'Original save request:',
                                'Thing '+JSON.stringify(source.thing, null, 2),
                                'Draft '+JSON.stringify(source.draft, null, 2),
                                'Save type: '+(source.thing_SAVE_TYPE===SAVE_TYPES.IS_INSERT&&'IS_INSERT'||source.thing_SAVE_TYPE===SAVE_TYPES.IS_UPDATE&&'IS_UPDATE'||source.thing_SAVE_TYPE===SAVE_TYPES.IS_UPSERT&&'IS_UPSERT'||'Unknow save type, dev needs to fix me'),
                            ].join('\n'));
                        }
                        throw err;
                    })
                )
                .then(() => {
                    if( !dont_apply_side_effects ) {
                        return interpolate.apply_side_effects(thing, {Thing});
                    }
                })
                .catch(err => { 

                    const COULD_NOT_SERIALIZE = err.code === '40001';
                    const DEAD_LOCK = err.code === '40P01';
                    const EVENT_CREATED_AT_NOT_UNIQUE = err.code === '23505' && err.constraint === 'thing_event_created_at_unique';
                    const RETRY = (() => {
                        return [
                            COULD_NOT_SERIALIZE,
                            // about this deadlock catch;
                            // - not sure why deadlock can happen here since we use pg's serialize feature
                            DEAD_LOCK,
                            EVENT_CREATED_AT_NOT_UNIQUE,
                        ].some(b => b);
                    })();

                    return (
                        Promise.resolve()
                    )
                    .then(() => {
                        if( transaction ) {
                            return transaction.rollback_promise();
                        }
                    })
                    .then(() => {
                        if( RETRY ) {
                            Object.defineProperty(thing, FAILED, {value: (thing[FAILED]||0)+1, writable: true});
                            assert(thing.propertyIsEnumerable(FAILED) === false);

                            if( thing[FAILED] !== 1 ) {
                                return do_retry().then(things_updated_ => {things_updated = things_updated_});
                            }

                            // The purpose of `sequential_retry_chain` is to run retries of several things sequentially.
                            // In order to avoid concurent saves to clash over and over again.
                            sequential_retry_chain = sequential_retry_chain.then(() => {
                                return do_retry().then(things_updated_ => {things_updated = things_updated_});
                            });
                            return sequential_retry_chain;
                        }

                        throw err;
                    });

                    function do_retry() {

                        return do_it_with_delay();

                        function do_it_with_delay() {
                            return new Promise(resolve => {
                                setTimeout(
                                    () => {
                                        // onsole.log((DEAD_LOCK&&'[DEAD_LOCK]'||COULD_NOT_SERIALIZE&&'[COULD_NOT_SERIALIZE]'||'[EVENT_CREATED_AT_NOT_UNIQUE]')+' '+thing[FAILED]+'-th retry of thing with type '+thing.type+ ' and draft '+JSON.stringify(source.draft));
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

                            for(var prop in thing) delete thing[prop];
                            for(var prop in draft) delete draft[prop];
                            Object.assign(thing, clone_object(source.thing));
                            Object.assign(draft, clone_object(source.draft));
                            thing[SAVE_TYPE] = source.thing_SAVE_TYPE;
                            return thing.draft.save();
                        }
                    }

                }); 
            })
            .then(() => things_updated);

            assert(false);

            function update_referred_things() { 
                // we also need to update the `view` interpolated property of certain referred things
                // - e.g. we need this when tagging a resource -> the tag needs to be inserted into the `view` property of the resource
                return Promise.all(
                    get_referred_things_with_cascade_save()
                    .map(referred_id => {
                        assert( transaction && transaction.rid );
                        return Thing.database.load.things({id: referred_id}, {transaction})
                        .then(things => {
                            assert(things.length === 1);
                            return things[0];
                        })
                        .then(thing_referred => thing_referred[SYNC_WITH_DB]({transaction, dont_validate_current_saved_things}))
                    })
                );

                function get_referred_things_with_cascade_save() {
                    return Object.entries(thing.schema)
                    .map(keyval => {
                        const prop = keyval[0];
                        const spec = keyval[1];
                        if( dont_cascade_saving ) return null;
                        if( !spec.cascade_save ) return null;
                        return thing[prop];
                    })
                    .filter(referred_id => referred_id)
                }
            } 

            function clone_object(obj) { 
                return (
                    JSON.parse(JSON.stringify(obj))
                );
            } 

            function deep_equal(a, b) { 
                if( [a, b].every(o => (o||0).constructor === Object) ) {
                    return []
                        .concat(Object.keys(a), Object.keys(b))
                        .every(key => deep_equal(a[key], b[key]));
                }
                return a === b;
            } 
        }; 
    })(); 

    Thing.debug = {
        get_things_sync: () => debug.get_things_sync(Thing),
        log: debug.log,
    };

    Thing.SchemaError = SchemaError;
    Thing.ValidationError = ValidationError;

    // TODO - get rid of
    Thing.http_max_delay = state.http_max_delay;
    Thing.db_handle = db_handle;

    return Thing;

    function migrate_schema_unique_tuples () { 
        if( ! state.migration_applied ) {
            state.migration_applied = db_interface.table.thingdb_schema_unique_constraints.apply({Thing, db_handle});
        }
        return state.migration_applied;
    }; 
}
