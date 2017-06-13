import assert from 'assertion-soft';
import Thing from  '../thing';
import assert_soft from 'assertion-soft';


const VOTE_SAVER = Symbol();

const VOTE_TYPES = ['upvote', 'agreeing'];

export default (cls, {author_can_selfvote}={}) => {
    assert_soft([true, false].includes(author_can_selfvote));
    return (
        class extends(cls) {
            // - note that the returned objects are re-created on each property access
            // - in case of computation issues; memoize returned object
            get votable() {
                const thing = this;

                const io = {}
                VOTE_TYPES
                .forEach(vote_type => {
                    const args = {thing, vote_type, author_can_selfvote};
                    io[vote_type] = {
                        number_of: function({is_negative=false}={}) {
                            return number_of_votes({is_negative, ...args});
                        },
                        toggle: function({is_negative=false}={}) {
                            return toggle_vote({is_negative, ...args});
                        },
                        user_did: function({is_negative=false}={}) {
                            return logged_user_did_vote({is_negative, ...args});
                        },
                    };
                });

                return io;
            }
        }
    );
};


function number_of_votes({thing, vote_type, is_negative}) {
    assert_input.apply(null, arguments);

    if( !thing.id ) return 0;

    const votes = (
        Thing
        .get_things_from_cache({
            type: 'genericvote',
            vote_type,
            referred_thing: thing.id,
            is_negative,
        })
        .filter(t => !t.is_removed)
        .filter(t => t.author!==thing.author)
    );

    return votes.length + (author_did_vote.apply(null, arguments)?1:0);
}

function toggle_vote({thing, vote_type, is_negative}) {
    assert_input.apply(null, arguments);
    assert_soft( (Thing.things.logged_user||{}).id );
    assert_soft( thing.id );

    return new Thing({
        type: 'genericvote',
        vote_type,
        referred_thing: thing.id,
        author: Thing.things.logged_user.id,
        draft: {
            is_removed: !!logged_user_did_vote.apply(null, arguments),
            is_negative,
        },
    }).draft.save();
}

function logged_user_did_vote(args) {
    assert_input.apply(null, arguments);
    assert_soft( !Thing.things.logged_user || (Thing.things.logged_user||{}).id );

    const user_id = (Thing.things.logged_user||{}).id;

    if( ! user_id ) {
        return false;
    }

    return user_did_vote({user_id, ...args});
}

function author_did_vote(args) {
    assert_input.apply(null, arguments);
    assert_soft(args.thing, args.thing);

    const user_id = (args.thing||{}).author;
    assert_soft(user_id);
    if( !user_id ) {
        return false;
    }

    assert_soft( !('user_id' in args) );

    return user_did_vote({user_id, ...args});
}

function user_did_vote({user_id, thing, vote_type, is_negative, author_can_selfvote}) {
    assert_input.apply(null, arguments);
    assert_soft(user_id);

    if( !user_id ) {
        return false;
    }
    if( !thing.id ) {
        return false;
    }

    const user_votes = (
        Thing
        .get_things_from_cache({
            type: 'genericvote',
            vote_type,
            referred_thing: thing.id,
            author: user_id,
        })
    );
    assert_soft(user_votes.length<=1, JSON.stringify(user_votes, null, 2));

    const user_vote = user_votes[0];

    if( user_vote ) {
        assert_soft([true, false].includes(user_vote.is_negative));
        assert_soft([true, false].includes(user_vote.is_removed));

        return user_vote.is_negative === is_negative && !user_vote.is_removed;
    }

    if( thing.author === user_id ) {
        return author_can_selfvote && !is_negative;
    }

    return false;
}

function assert_input({thing, vote_type, is_negative, author_can_selfvote}) {
    assert_soft( arguments.length === 1 );

    assert_soft( thing );
    assert_soft( thing instanceof Thing );
    assert_soft( thing.author, thing );

    assert_soft( vote_type );
    assert_soft( VOTE_TYPES.includes(vote_type) );

    assert_soft( [true, false].includes(is_negative) );

    assert_soft( [true, false].includes(author_can_selfvote) );
}
