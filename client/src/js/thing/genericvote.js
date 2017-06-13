import Thing from './thing.js';

class Genericvote extends Thing {
    constructor(...args) {

        /*
        // temporary patch to make is_negative a required prop
        if( args[0].is_negative === undefined && (args[0].draft||{}).is_negative === undefined ) {
            if( Object.keys(args[0].draft||{}).length>0 ) {
                args[0].draft.is_negative = false;
            } else {
                args[0].is_negative = false;
            }
        }
        */

        super(...args);
    }
};
Genericvote.type = 'genericvote'; // UglifyJS2 mangles class name
Genericvote.props_immutable = Thing.props_immutable.concat(['referred_thing', 'vote_type', 'is_negative', 'author', ]);
Genericvote.props_required = Genericvote.props_immutable;
export default Genericvote;

