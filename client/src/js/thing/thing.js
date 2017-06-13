import assert from 'assertion-soft';
import validator from 'validator';
import http from './http';
import Promise from 'bluebird';
Promise.longStackTraces();
import assert_soft from 'assertion-soft';


class Cache {
    constructor() {
        this._store = {};
    }
    get(obj) {
        return this._store[this._hash(obj)];
    }
    add(obj, value) {
        const key = this._hash(obj);

        assert( ! this._store[key] );

        this._store[key] = value;
    }
    _hash(obj) {
        assert(obj.constructor === Object);
        assert(Object.values(obj).every(v => [null, undefined].includes(v) || ![Object, Array].includes(v.constructor)));

        return JSON.stringify(Object.entries(obj).sort(([key1], [key2]) => key1<key2));
    }
}
const cache__referrers = new Cache();


const IS_UPSERT = Symbol();
const KEY_VALUE = Symbol();

export default class Thing {
    constructor(props, thing_key) { 
        assert(props);
        assert(props.type);

        if( this.constructor === Thing ) {
            for(let subclass of Object.values(Thing.typed)) {
                assert( subclass.type );
                if( subclass.type === props.type ) {
                    const that = new subclass(props, thing_key);
                    assert( that.constructor === subclass );
                    return that;
                }
            }
        }

        const draft = props.draft||{};
        delete props.draft;

        assert_soft(this.constructor.props_immutable);
        const props_immutable = this.constructor.props_immutable||[];

        assign_immutable({
            obj: this,
            props_immutable,
            values: props,
        });

        Object.defineProperty(this, 'draft', {value: new Draft(this)});
        assign_immutable({
            obj: this.draft,
            props_immutable,
            values: draft,
        });

        assert_soft(this.constructor.props_required);
        check_required_props(this, this.constructor.props_required||[]);

        // we use this as to have a key for things that are new and therefore don't have an id yet (ID comes from backend)
        // - we use it as key for react
        // - we use it to know what thing to replace, when new thing information comes from backend
        Object.defineProperty(this, 'key', {
            value: (() => {
                assert( ! this[IS_UPSERT] || [null,undefined].includes(thing_key) );
                if( this[IS_UPSERT] )
                    return null;
                if( thing_key )
                    return thing_key;
                if( this.id )
                    return this.id;
                return  Math.random().toString();
            })(),
            enumerable: false,
            configurable: false,
            writable: false,
        });

        return this;

        function assign_immutable({obj, props_immutable, values}) { 
            Array.from(new Set(
                Object.keys(values)
                .concat(props_immutable)
            ))
            .forEach(prop => {
                const val_init = values[prop];
                if( ! props_immutable.includes(prop) ) {
                    obj[prop] = val_init;
                } else {
                    assert_soft(val_init!==null);
                    if( ![null, undefined].includes(val_init) ) {
                        Object.defineProperty(obj, prop, {value: val_init, enumerable: true});
                    } else {
                        Object.defineProperty(obj, prop, {
                            enumerable: false,
                            configurable: true,
                            set: val => {
                                assert_soft(![null, undefined].includes(val));
                                Object.defineProperty(obj, prop, {value: val, enumerable: true});
                            },
                        });
                    }
                }
            });
        } 

        function check_required_props(thing, props_required) { 
            props_required
            .forEach(prop => {
                assert_soft([thing[prop], thing.draft[prop]].some(val => ![null, undefined].includes(val)), thing.type, prop);
            });
        } 
    } 

    get [IS_UPSERT] () { 
        assert(this.type);
        return !this.id && Object.keys(this).length !== 1;
    } 

    get is_new() { 
        return (
            ! this.id &&
            ! this[IS_UPSERT]
        );
    } 

    get referrers() { 
        if( this.is_new ) return [];

        const REFERRING_PROPS = ['referred_resource', 'referred_thing', 'referred_tag', 'referred_tagged', ];

        let referrers = (
            Thing.things.all
            .filter(thing => REFERRING_PROPS.map(prop => thing.draft[prop]||thing[prop]).includes( this.id ))
            .filter(thing => !thing.is_removed)
        );

        referrers = Thing.sort(referrers);

        return referrers;
    } 

    get_prop_val(key) { 
        if( key.constructor !== String || !key.includes('.') ) {
            return this[key];
        }
        let value = this;
        key.split('.').forEach(prop => {
            assert(value, "path of props `"+key+"` has a hole/gap");
            value = value[prop];
        });
        return value;
    } 

    get author_name() { 
        const author_id = this.author;
        assert(author_id);
        const author_thing = Thing.things.id_map[author_id];
        assert(author_thing);
        const github_username = author_thing.user_name;
        assert(github_username);
        return github_username;
    } 

    get is_author() { 
        return (
            Thing.things.logged_user &&
            Thing.things.logged_user.id === this.author
        );
    } 

    toString() { 
        return JSON.stringify(
            Object.assign({
                draft: Object.assign({}, this.draft),
            }, this)
        , null, 2);
    } 

    static list_things ({order, filter_function, list}={}) { 

        assert(this.prototype instanceof Thing);
        assert(this !== Thing);
        assert(this.type);

        let things = list || Thing.things.of_type[this.type] || [];

        if( filter_function ) {
            things = filter_function(things);
        }

        return Thing.sort(things, Object.assign({}, {order: order||{}}, {type: this.type}));

    } 

    static retrieve_things (properties_filter, {result_fields}={}) { 
        assert(Object.keys(properties_filter).length>0);

        properties_filter = Object.assign({}, properties_filter);

        if( this !== Thing ) {
            assert(this.prototype instanceof Thing);
            assert(this.type);
            Object.assign(properties_filter, {type: this.type});
            assert(result_fields===undefined);
            assert(this.result_fields);
            result_fields = this.result_fields;
        }

        assert(result_fields);

        return http.retrieve_things({
            properties_filter,
            result_fields,
        });
    } 

    static sort(things, opts={}) { 
        assert(things && things.constructor === Array);

        if( things.length === 0 ) {
            return things;
        }

        if( opts.type ) {
            opts.ThingTyped = Thing.typed[opts.type];
        }

        if( ! opts.ThingTyped ) {
            const ThingTyped__candidate = things[0].constructor;

            const all_same_thing_typed = things.every(t => t.constructor === ThingTyped__candidate);

            if( all_same_thing_typed ) {
                opts.ThingTyped = ThingTyped__candidate;
            }
        }

        const date_before = new Date();
        const things_sorted = things.sort(get_order_fct(opts));
        const date_after = new Date();
        if( date_after - date_before > 350 ) {
            console.warn('slow sorting of '+things.length+' things took '+(date_after - date_before)+'ms . With opts '+JSON.stringify(opts));
        }

        return things_sorted;

        function get_order_fct(opts) {

            assert(opts.ThingTyped === undefined || opts.ThingTyped && (opts.ThingTyped.prototype instanceof Thing || opts.ThingTyped === Thing));

            if( opts.ThingTyped ) {
                return get_sorter_for_type(opts);
            }

            return sorter;

            function sorter(thing1, thing2) {

                const THING1_FIRST = -1;
                const THING2_FIRST = 1;
                const NO_ORDER = 0;

                // - make sure that things of the same type are grouped together
                // - alphabetic sorting of types is by accident and is not required
                if( thing1.constructor !== thing2.constructor ) {
                    assert(thing1.type && thing2.type);
                    return thing1.type < thing2.type ? THING1_FIRST : THING2_FIRST;
                }

                if( thing1.constructor === thing2.constructor ) {
                    return get_sorter_for_type(Object.assign(opts, {ThingTyped: thing1.constructor}))(thing1, thing2);
                }

                assert(false);

            }

            function get_sorter_for_type(opts) {

                assert(opts.ThingTyped);
                const order = opts.ThingTyped.order(opts.order||{});

                if( order.constructor === Array ) {
                    return orderBy(order);
                }

                if( order.constructor === Object ) {
                    assert(order.sort_function);
                    return order.sort_function;
                }

                if( order.constructor === Function ) {
                    return ((thing1, thing2) => {
                        const sort_value = order(thing1, thing2);
                        if( [-1, 0, 1].includes(sort_value) ) {
                            return sort_value;
                        }
                        if( sort_value.constructor === Array ) {
                            return orderBy(sort_value)(thing1, thing2);
                        }
                        assert(false);
                    });
                }

                assert(false);

            }

            function orderBy(props) {
                assert(props.constructor === Array);

                props = props.map(prop_spec => {
                    assert([Object, String].includes(prop_spec.constructor));
                    if( prop_spec.constructor === String ) {
                        const to_negate = prop_spec.slice(0,1)==='-';
                        const key = to_negate ? prop_spec.slice(1) : prop_spec;
                        prop_spec = {
                            key,
                            to_negate,
                        };
                    }
                    assert(Object.keys(prop_spec).every(k => ['key', 'to_negate'].includes(k)));
                    return prop_spec;
                });

                document_js_comparison();

                const THING1_FIRST = -1;
                const THING2_FIRST = 1;
                const NO_ORDER = 0;

                return ((thing1, thing2) => {
                    for(let prop_spec of props) {
                        const thing1_val = get_val(thing1, prop_spec);
                        const thing2_val = get_val(thing2, prop_spec);
                        if( thing1_val===null && thing2_val===null ) {
                            continue;
                            assert(false);
                        }
                        if( thing1_val===null ) {
                            return THING2_FIRST;
                        }
                        if( thing2_val===null ) {
                            return THING1_FIRST;
                        }
                        if( thing1_val > thing2_val ) {
                            return THING1_FIRST;
                        }
                        if( thing2_val > thing1_val ) {
                            return THING2_FIRST;
                        }
                    }

                    return NO_ORDER;
                });

                function get_val(thing, prop_spec) {
                    const NULLY = [null, undefined, NaN, ];

                    /*
                    if( prop_spec.constructor === Function ) {
                        return prop_spec(thing);
                    }
                    */

                    let val = thing.get_prop_val(prop_spec.key);

                    if( NULLY.includes(val) ) {
                        return null;
                    }

                    const val_constructor = val.constructor;

                    if( val_constructor === Date ) {
                        val = +val;
                    }

                    if( val_constructor === Boolean ) {
                        val = val ? 1 : 0;
                    }

                    if( prop_spec.to_negate ) {
                        assert(val.constructor === Number, val);
                        val = -val;
                    }

                    return val;
                }

                function document_js_comparison() {
                    // order computatin is based on following
                    assert( (true > false) === true )
                    assert( (true < false) === false )
                    assert( (new Date() > new Date(1970)) === true );
                    assert( (new Date() < new Date(1970)) === false );
                    assert( (undefined < 1) === false );
                    assert( (undefined > 1) === false );
                    assert( (undefined > new Date()) === false );
                    assert( (undefined < new Date()) === false );
                    assert( (null < 1) === true );
                    assert( (null > 1) === false );
                    assert( (null > null) === false );
                    assert( (null < null) === false );
                    assert( (null < new Date()) === true );
                }
            }
        }
    } 

    static order() { 
        return [
            'updated_at',
        ];
    } 

    static get_by_id(id, {can_be_null}={}) { 
     // id can be the id of a category which is not a UUID for now
     // assert(!id || validator.isUUID(id));
        const ret = Thing.things.all.find(thing => thing.id === id);
        assert_soft(ret || can_be_null, "can't find Thing with id `"+id+"`");
        return ret || null;
    } 

    static get_by_props(props, {can_be_null, can_be_removed}={}) { 
        assert(this.prototype instanceof Thing);
        assert(this !== Thing);
        assert(this.type);
        assert(props);
        assert(props.constructor === Object);
        assert([this.type, undefined].includes(props.type));

        let things = (
            Thing
            .things
            .all
            .filter(thing =>
                thing.type === this.type &&
                Object.entries(props)
                .every(([prop, val]) => {
                    if( (val||0).constructor === String && (thing[prop]||0).constructor === String ) {
                        return thing[prop].toLowerCase() === val.toLowerCase();
                    }
                    return thing[prop] === val;
                })
            )
        );

        assert_soft(things.length<=1, things, props);

        if( !can_be_removed ) {
            things = things.filter(thing => !thing.is_removed);
        }

        let thing = things[0];

        if( ! thing ) {
            assert_soft(can_be_null, props);
            return null;
        }

        return thing;
    } 

    static retrieve_by_props(props) { 
        assert(this.prototype instanceof Thing);
        assert(this !== Thing);
        assert(this.type);
        assert([this.type, undefined].includes(props.type));

        const thing = this.get_by_props(props, {can_be_removed: true});
        if( thing ) {
            return Promise.resolve(thing);
        }

        return (
            this.retrieve_things(props)
        )
        .then(([thing=null]) => thing);
    } 

    static get typed () { 
        const CLS_TYPES = [
            'resource',
            'tag',
            'user',
            'comment',
            'reviewpoint',
            'genericvote',
        ];

        const ret = {};
        CLS_TYPES.forEach(type => {
            // webpack can handle this require statically but not babel
            const cls = require('./'+type).default;
            assert(cls.type === type);
            ret[type] = cls;
        });
        return ret;
    } 

    static get_or_create(props) { 
        assert(props && props.constructor === Object);
        assert(props.type);

        const draft = Object.assign({}, props);
        delete draft.is_new;
        delete draft.type;

        let thing;

        thing =
            Thing.things.all
            .find(thing => {
                for(let i in props) if( thing[i] !== props[i] && thing.draft[i] !== props[i] ) return false;
                return true;
            })

        if( thing ) {
            return thing;
        }

        thing =
            new Thing({
                type: props.type,
                draft,
            });

        Thing.things.all[Thing.things.all.length] = thing;

        return thing;
    } 

    static get result_fields() { 
        return [
            'id',
            'type',
            'updated_at',
        ];
    } 

    static get_things({type, ...props}) { 
        assert_soft(type);

        return (
         // Thing.things.of_type[type] // TODO
            Thing.things.all
            .filter(thing => {
                if( thing.type !== type ) return false;
                assert_soft(thing.type === type); // TODO
                return (
                    Object.entries(props)
                    .every(([prop, val]) => {
                        assert_required(thing, prop, val);
                        assert_immutability(thing, prop);
                        return [thing[prop], thing.draft[prop]].includes(val);
                    })
                );
            })
        );

        function assert_immutability(thing, prop) {
            assert_immutability_of_prop(thing, prop);
            assert_immutability_of_prop(thing.draft, prop);
            assert_soft(![thing[prop], thing.draft[prop]].every(v => [null,undefined].includes(v)), thing.type, prop, thing[prop], thing.draft[prop]);
            assert_soft(thing[prop]===undefined || thing.draft[prop]===undefined || thing[prop]===thing.draft[prop]);
        }
        function assert_required(thing, prop, val) {
            assert_soft(![null, undefined].includes(val), thing.type, prop, val, thing);
            assert_soft([thing[prop], thing.draft[prop]].some(v => ![null, undefined].includes(v)), thing.type, prop);
        }
        function assert_immutability_of_prop(obj, prop){
            const descriptor = Object.getOwnPropertyDescriptor(obj, prop);
            assert_soft(descriptor, obj, prop, obj[prop]);
            assert_soft(!descriptor || !descriptor.writable, obj, prop, obj[prop]);
        }

    } 

    static get_things_from_cache(props) { 

        return this.get_things(props);

        assert(props);
        let result = cache__referrers.get(props);

        if( ! result ) {
            result = this.get_things(props);
            cache__referrers.add(props, result);
        }

        return result;
    } 

    static get insight() { 
        const all = Thing.things.all;
        const resources__insights = {};

        [...new Set(
            all.filter(t => t.type==='tagged').map(t => t.referred_resource)
        )]
        .forEach(resource_id => {
            const resource = Thing.get_by_id(resource_id);
            resources__insights[resource.npm_package_name] = resource.insight;
        });

        console.log(JSON.stringify(resources__insights, null, 2));
        console.log(resources__insights);
    } 

    // *c*onsole *s*earch
    static cs(str) { 
        assert_soft(str);
        const hits = (
            Thing.things.all
            .filter(t => {
                if( t.type==='tag' ) {
                    if( t.is_category ) {
                        if( t.category__title.toLowerCase().includes(str) ) {
                            return true;
                        }
                    }
                    if( t.is_catalog ) {
                        if( t.name.toLowerCase().includes(str) ) {
                            return true;
                        }
                    }
                }
                if( t.type==='resource' ) {
                    if( t.resource_name.toLowerCase().includes(str) ) {
                        return true;
                    }
                }
                return false;
            })
        );
        const single_hit = hits.length===1 && hits[0];
        if( single_hit ) {
            return single_hit.toString();
        }
        return (
            hits || null
        );
    } 

    static generate_human_id(name) { 
        if( ! assert_soft((name||1).constructor===String, name) ) return name;

        let hid = name;
        hid = hid.toLowerCase();
        if( /\s/.test(hid) ) {
            hid = hid.replace(/[^\sa-z0-9]/g, '');
            hid = hid.replace(/[\s]/g, '-');
        } else {
            hid = hid.replace(/[^\-a-z0-9]/g, '');
        }
        hid = encodeURIComponent(hid);
        return hid;
    } 
}

const THE_THING = Symbol();
class Draft { 
    constructor(thing) {
        Object.defineProperty(this, THE_THING, {value: thing});
    }

    save() {
        const thing = Object.assign({}, this[THE_THING]);
        const draft = Object.assign({}, this);

        for(let i in draft) {
            if( i === 'author' )
                continue;
            if( draft[i] === thing[i] ) {
                delete draft[i];
            }
        }

        const thing_info =
            Object.assign(
                Object.assign({}, thing) ,
                { draft: Object.assign({}, draft)}
            );

        // we need this to replace new thing with thing coming from backend
        const thing_key = thing.key;

        return (
            http.save(thing_info, thing_key)
            .then(ret => {
                for(var prop in this) {
                    if( (this[THE_THING].constructor.props_immutable||[]).includes(prop) ) {
                        continue;
                    }
                    delete this[prop];
                }
                return ret;
            })
        )
    }
}; 

Thing.things = {
    all: [],
    of_type: {},
    id_map: {},
    logged_user: null,
};

Thing.props_immutable = ['type', ];
Thing.props_required = Thing.props_immutable;

Thing.load = {
    view: http.view,
    logged_user: http.logged_user,
};
