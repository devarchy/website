"use strict";
require('babel-polyfill');
const assert = require('assert');
const database = require('./database');
const migrate = require('./migrate');
const validate = require('./validate');
const interpolate = require('./interpolate');
const Promise = require('bluebird');
Promise.longStackTraces();
const uuid = require('node-uuid');
const debug = require('./debug');
const NetworkConnectionError = require('../../util/network_connection_error');
const Promise_serial = require('promise-serial');


let thingdb_schema;

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

            const unique_key = (() => {
                const unique_key = {};
                for(var prop in this) {
                    if( prop_is_part_of_unique_key(this.schema, prop) ) {
                        unique_key[prop] = this[prop];
                    }
                }
                assert(Object.keys(unique_key).length>0);
                assert(unique_key.type);
                return unique_key;
            })();

            return (
                Thing.database.load.things(unique_key, {transaction})
            )
            .then( things => {
                assert( things.length <= 1 );

                const thing_in_db = things[0];

                if( thing_in_db ) {
                    Object.keys(this)
                    .forEach(prop => {
                        if( ! prop_is_part_of_unique_key(this.schema, prop) ) {
                            return;
                        }
                        const v1 = this[prop];
                        const v2 = thing_in_db[prop];
                        assert(
                            [v1, v2].every(v => (v||0).constructor === String) ?  v1.toLowerCase() === v2.toLowerCase() : v1 === v2 ,
                            "diverging unique prop: `"+v2+"!=="+v1+'`'
                        );
                    });
                }

                for(var prop in this) {
                    if( ['type', 'id', 'author', ].includes(prop) ) {
                        continue;
                    }
                    if( thing_in_db && thing_in_db[prop] === this[prop] ) {
                        continue;
                    }
                    this.draft[prop] = this[prop];
                    delete this[prop];
                }

                assert( !this.id || thing_in_db );
                this.id = thing_in_db ? thing_in_db.id : uuid.v4();

                const draft_is_empty = Object.keys(this.draft).length === 0;

                assert( Thing.schema.user );
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

            function prop_is_part_of_unique_key(type_schema, prop) {
                return (
                    prop === 'type' ||
                    (type_schema[prop]||{}).is_unique ||
                    ((type_schema._options||{}).is_unique||[]).includes(prop)
                );
            }
        }
    } 

    [SYNC_WITH_DB] ({transaction, dont_validate_current_saved_things}) { 
        return Promise.resolve()
        .then(() => {
            if( dont_validate_current_saved_things ) {
                return;
            }
            validate.assert.correctness_and_completness_without_draft(this);
        })
        .then(() =>
            interpolate.aggregate_events(
                this,
                {
                    is_insert: this[SAVE_TYPE]===SAVE_TYPES.IS_INSERT,
                    transaction,
                    dont_validate_current_saved_things,
                }
            )
        )
        .then(() => {
            validate.assert.correctness_and_completness_without_draft(this);
        })
        .then(() =>
            interpolate.compute_views(this, transaction)
        )
        .then(() => {
            validate.assert.correctness_and_completness_without_draft(this);
        })
        .then(() =>
            // provide up to date database to schema.js when calling `apply_schema`
            // - e.g. computed property `preview` in schema needs updated computed views
            database.save.thing(this, transaction)
        )
        .then(() =>
            interpolate.apply_schema(this, transaction)
        )
        .then(() => {
            assert(this.history); // TODO move this in validation code
            validate.assert.correctness_and_completness_without_draft(this);
        })
        .then(() =>
            database.save.thing(this, transaction)
        )
        .then(() =>
            this
        );
    } 

    get schema() { 
        assert(Thing.schema);
        assert(this.type);
        const schema = Thing.schema[this.type];
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

    static set schema(schema) { 
        if( thingdb_schema ) {
            throw new Error("Dynamically changing schema is not supported"); // because of migrate_schema_unique_tuples
        }
        thingdb_schema = schema;
        return thingdb_schema;
    } 
    static get schema() { 
        return (
            thingdb_schema
        );
    } 
}

Thing.database = { 
    management: {
        delete_all: () => database.table.delete_all(),
        create_schema: database.table.create_schema,
        migrate,
    },
    close_connections: () => {
        require('./database/connection')().destroy();
        require('../../util/long_term_cache').close_connection();
    },
    load: (() => {
        return {
            things,
            all_things,
            view,
        };

        function things(props) {
            assert( props && Object.keys(props).length>0 && props.length===undefined );
            assert( props.draft === undefined && props.propertyIsEnumerable('draft') === false );
            return (
                database.load.things.apply(database.load, arguments)
            )
            .then(process_result)
        }

        function all_things() {
            assert(arguments.length === 0);
            return (
                database.load.things({})
            )
            .then(process_result)
        }

        function view(props) {
            if( !props ) {
                throw new Error('Thing.database.load.view requires property filter argument');
            }
            if( props.constructor !== Array ) {
                throw new Error('Thing.database.load.view requires the property filter argument to be an array');
            }
            return (
                database.load.view.apply(database.load, arguments)
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

Thing.debug = debug;

const THING = Symbol();
class Draft {
    constructor(thing) {
        assert(thing);
        this[THING] = thing;
    }
    save({transaction}={}) {
        assert(this[THING].constructor === Thing);
        assert(this[THING].draft === this);

        return save_thing_draft(this[THING], {save_on_empty_draft: false, transaction});
    }
}

class SchemaError extends Error { constructor(m) { super(/*'SchemaError: '+*/m); } };
Thing.SchemaError = SchemaError;
class ValidationError extends Error { constructor(m) { super(/*'ValidationError: '+*/m); } };
Thing.ValidationError = ValidationError;
Thing.NetworkConnectionError = NetworkConnectionError;

module.exports = Thing;


const save_thing_draft = (() => {

    const FAILED = Symbol();

    let sequential_retry_chain = Promise.resolve();

    return (thing, {save_on_empty_draft, transaction, dont_validate_current_saved_things=false, dont_cascade_saving, dont_apply_side_effects}) => { 

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
        .then(() => ! transaction && database.transaction().then(t => transaction=t) )
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
                validate.correctness_and_completness_without_draft(thing);
            }
            else {
                validate.correctness_and_completness_with_draft(thing);
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
                    return database.save.event(thing.id, thing.type, Object.assign({}, draft), thing.schema, transaction)
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
                validate.assert.correctness_and_completness_without_draft(thing)
            })
            .then(() => thing[SYNC_WITH_DB]({transaction, dont_validate_current_saved_things}) )
            .then(() => update_referred_things() )
            .then(things_referred => {things_updated = things_updated.concat(things_referred)} )
            .then(() =>
                transaction.commit_promise()
                .catch(err => {
                    if( (err||{}).code === '23P01' &&
                        database.table.thingdb_schema_unique_constraints.constraints[(err||{}).constraint] ) {
                        const constraint_info = database.table.thingdb_schema_unique_constraints.constraints[err.constraint];
                        assert(constraint_info.type === thing.type);
                        throw new Thing.ValidationError([
                            'Thing with type `'+thing.type+'` and',
                            constraint_info.tuple.map(prop => prop+' `'+thing[prop]+'`').join(' and '),
                            'already exists in database',
                        ].join(' '));
                    }
                    throw err;
                })
            )
            .then(() => {
                if( !dont_apply_side_effects ) {
                    return interpolate.apply_side_effects(thing);
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

const migrate_schema_unique_tuples = (() => { 
    let migration_applied = false;
    return () => {
        if( migration_applied ) return Promise.resolve();
        migration_applied = true;
        return database.table.thingdb_schema_unique_constraints.apply();
    };
})(); 
