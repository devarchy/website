import assert from 'assert';
import Thing from  '../thing';


const VOTE_SAVER = Symbol();

const VotableMixin = {
    // - note that the returned objects are re-created on each property access
    // - in case of computation issues; memoize returned object
    get votable() {
        const thing = this;

        return {
            upvote: {
                number_of: function({is_negative=false}={}) {
                    return number_of_votes(thing, 'upvote', is_negative);
                },
                toggle: function({is_negative=false}={}) {
                    return toggle_vote(thing, 'upvote', is_negative);
                },
                user_did: function({is_negative=false}={}) {
                    return user_did_vote(thing, 'upvote', is_negative);
                },
            },
        };
    },
};

export default VotableMixin;


function number_of_votes(thing, vote_type, is_negative) {
    assert_input.apply(null, arguments);
    return (
        thing.referrers.filter(
            r => r.type==='genericvote' &&
            r.removed===false &&
            r.vote_type===vote_type &&
            !!r.is_negative === !!is_negative
        ).length
    );
}

function toggle_vote(thing, vote_type, is_negative) {
    assert_input.apply(null, arguments);
    assert( (Thing.things.logged_user||{}).id );

    return new Thing({
        type: 'genericvote',
        vote_type,
        referred_thing: thing.id,
        author: Thing.things.logged_user.id,
        draft: {
            removed: !!user_did_vote.apply(null, arguments),
            is_negative,
        },
    }).draft.save();
}

function user_did_vote(thing, vote_type, is_negative) {
    assert_input.apply(null, arguments);

    if( ! Thing.things.logged_user )
        return false;

    const genericvotes = thing.referrers.filter(
        t =>
            t.type === 'genericvote' &&
            t.author === Thing.things.logged_user.id &&
            t.vote_type === vote_type &&
            !!t.is_negative === !!is_negative
    );
    assert( genericvotes.length <= 1, JSON.stringify(genericvotes, null, 2) );
    return genericvotes.filter(a => a.removed===false).length === 1;
}

function assert_input(thing, vote_type, is_negative) {
    assert( thing );
    assert( thing instanceof Thing );
    assert( thing.id );
    assert( vote_type );
    assert( ['upvote'].includes(vote_type) );
    assert( [true, false].includes(is_negative) );
}
