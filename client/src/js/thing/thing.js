import assert from 'assert';
import validator from 'validator';
import http from './http';
import Promise from 'bluebird';
Promise.longStackTraces();


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

        const draft = props.draft;
        delete props.draft;

        Object.assign(this, props);

        Object.defineProperty(this, 'draft', {
            value: new Draft(this),
            enumerable: false,
            configurable: false,
            writable: false,
        });
        Object.assign(this.draft, draft);
        assert(!this.propertyIsEnumerable('draft'));
        assert(this.draft && this.draft.constructor === Draft);

        Object.defineProperty(this, 'constructed_at', {
            value: new Date(),
            enumerable: false,
            configurable: false,
            writable: false,
        });

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
        return (
            Thing.sort(
                Thing.things.all
                .filter(thing => REFERRING_PROPS.map(prop => thing.draft[prop]||thing[prop]).includes( this.id ))
            )
        );
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
        const github_username = author_thing.github_info.login;
        assert(github_username);
        return github_username;
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

    static retrieve_things (properties_filter={}) { 
        assert(this.prototype instanceof Thing);
        assert(this !== Thing);
        assert(this.type);
        assert(this.result_fields);

        return http.retrieve_things({
            properties_filter: Object.assign({}, properties_filter, {type: this.type}),
            result_fields: this.result_fields,
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
        if( date_after - date_before > 40 ) {
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

    static get_by_id(id) { 
     // id can be the id of a category which is not a UUID for now
     // assert(!id || validator.isUUID(id));
        const ret = Thing.things.all.find(thing => thing.id === id);
        assert(ret, id);
        return ret;
    } 

    static get_by_props(props) { 
        assert(this.prototype instanceof Thing);
        assert(this !== Thing);
        assert(this.type);
        assert(props);
        assert(props.constructor === Object);
        assert([this.type, undefined].includes(props.type));

        return Thing.things.all.find(thing =>
            thing.type === this.type &&
            Object.entries(props)
            .every(([prop, val]) => {
                if( (val||0).constructor === String && (thing[prop]||0).constructor === String ) {
                    return thing[prop].toLowerCase() === val.toLowerCase();
                }
                return thing[prop] === val;
            })
        );
    } 

    static retrieve_by_props(props) { 
        assert(this.prototype instanceof Thing);
        assert(this !== Thing);
        assert(this.type);
        assert([this.type, undefined].includes(props.type));

        const thing = this.get_by_props(props);
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
            'comment',
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
}

const THE_THING = Symbol();
class Draft { 
    constructor(thing) {
        Object.defineProperty(this, THE_THING, {value: thing});
        assert(this.propertyIsEnumerable(THE_THING) === false);
    }

    save() {
        const thing = this[THE_THING];
        const draft = this;

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

        return http.save(thing_info, thing_key);
    }
}; 

Thing.things = {
    all: [],
    of_type: {},
    id_map: {},
    logged_user: null,
};

Thing.load = {
    view: http.view,
    logged_user: http.logged_user,
};
