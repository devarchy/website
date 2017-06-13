import assert from 'assertion-soft';
import Thing from  '../thing';
import assert_soft from 'assertion-soft';


const created_at__parsed = Symbol();

const upvotes_count = Symbol();

export default cls => class extends cls {
    // - note that the returned objects are re-created on each property access
    // - in case of computation issues; memoize returned object
    get commentable () {
        const thing = this;
        return {
            add_reviewpoint ({is_negative}) {
                assert([true, false].includes(is_negative));
                assert(thing.type==='resource');
                assert(thing.id);
                comment_thing(thing, Object.assign({
                    type: 'reviewpoint',
                    referred_resource: thing.id,
                }, {is_negative}));
            },
            add_comment () {
                assert(['resource', 'comment', 'reviewpoint', ].includes(thing.type));
                const referred_resource = thing.type==='resource' ? thing.id : thing.referred_resource;
                assert(referred_resource);
                comment_thing(thing, {
                    type: 'comment',
                    referred_thing: thing.id,
                    referred_resource,
                });
            },
            get reviewpoints () {
                return (
                    get_notes(
                        thing,
                        {
                            type: 'reviewpoint',
                            referred_resource: thing.id,
                        }
                    )
                );
            },
            get comments () {
                return (
                    get_notes(
                        thing,
                        {
                            type: 'comment',
                            referred_thing: thing.id,
                        }
                    )
                );
            },
        };
    }

    constructor(...args) {
        super(...args);

        Object.defineProperty(this, 'is_editing', {
            value: false,
            writable: true,
            enumerable: false,
            configurable: false,
        });
    }

    get [created_at__parsed]() {
        if( this.created_at ) {
            return new Date(this.created_at);
        }
        if( this.is_new ) {
            return null;
        }
        assert(false);
    }

    get [upvotes_count]() {
        return this.votable.upvote.number_of();
    }

    static order() {
        return ['-is_new', {key: upvotes_count}, {to_negate: true, key: created_at__parsed}];
    }
};

function comment_thing(thing, props) {
    assert( Thing.things.logged_user );
    assert( Thing.things.logged_user.id );
    assert( thing instanceof Thing );
    assert( thing.id );

    const author = Thing.things.logged_user.id;

    const comment_creator = Thing.get_or_create(Object.assign(props, {is_new: true, author}));

    comment_creator.is_editing = true;
}

function get_notes(thing, props) {
    if( !thing.id ) return [];

    const comment_list = (
        Thing
        .get_things_from_cache(props)
        .filter(t => !t.is_new || t.is_editing)
        .filter(t => !t.is_removed)
    );

    assert_soft(comment_list.every(t => t.is_editing===true || t.created_at), comment_list, comment_list.map(c => c.is_new));

    return Thing.sort(comment_list);
}
