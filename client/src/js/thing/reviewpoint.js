import assert from 'assertion-soft';
import Thing from './thing.js';
import CommentableMixin from './mixins/commentable';
import VotableMixin from './mixins/votable';


class Reviewpoint extends VotableMixin(CommentableMixin(Thing), {author_can_selfvote: true}) {
    get is_a_negative_point() {
        assert([this.is_negative,  this.draft.is_negative].every(val => [undefined, true, false].includes(val)));
        if( this.is_negative !== undefined ) {
            return this.is_negative;
        }
        if( this.draft.is_negative !== undefined ) {
            return this.draft.is_negative;
        }
    }
};
Reviewpoint.type = 'reviewpoint'; // UglifyJS2 mangles class name
Reviewpoint.props_immutable = Thing.props_immutable.concat(['referred_resource', 'author', ]);
Reviewpoint.props_required = Reviewpoint.props_immutable;
export default Reviewpoint;
