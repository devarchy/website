import assert from 'assert';
import Thing from  '../thing';

export default {
    // - note that the returned objects are re-created on each property access
    // - in case of computation issues; memoize returned object
    get commentable () {
        const thing = this;
        return {
            add_comment () {
                comment_thing(thing);
            },
            get comments () {
                return get_comments(thing, 'referred_thing');
            },
            get comments_all() {
                assert(thing.type==='resource');
                return get_comments(thing, 'referred_resource');
            },
        };
    }
};

function comment_thing(thing) {
    assert( Thing.things.logged_user );
    assert( Thing.things.logged_user.id );
    assert( thing instanceof Thing );
    assert( thing.id );
    assert( thing.type==='resource' || thing.referred_resource );

    const author = Thing.things.logged_user.id;
    const referred_thing = thing.id;
    const referred_resource = thing.type==='resource' ? thing.id : thing.referred_resource;

    const comment_creator =
        Thing.get_or_create({
            type: 'comment',
            is_new: true,
            author,
            referred_thing,
            referred_resource,
        });
    comment_creator.editing = true;
}

function get_comments(thing, prop) {
    if( !thing.id ) return [];

    const comment_list =
        thing.referrers
        .filter(t => t.type === 'comment')
        .filter(t => [t[prop], t.draft[prop]].includes(thing.id))
        .filter(t => !t.is_new || t.editing)
        .filter(t => !t.removed);

    assert(comment_list.every(t => t.editing===true || t.created_at), comment_list);

    return Thing.sort(comment_list);
}
