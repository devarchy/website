import assert from 'assert';
import Thing from './thing.js';
import mixin from './mixin/mixin.decorator.js';
import CommentableMixin from './mixin/commentable';
import VotableMixin from './mixin/votable';


const created_at__parsed = Symbol();

@mixin(CommentableMixin)
@mixin(VotableMixin)
class Comment extends Thing {
    constructor(...args) {
        super(...args);

        Object.defineProperty(this, 'editing', {
            value: false,
            writable: true,
            enumerable: false,
            configurable: false,
        });
    }

    get [created_at__parsed]() {
        if( this.editing===true ) {
            return null;
        }
        assert(this.editing===false, "`this.editing==="+this.editing+"` for "+this);
        assert(this.created_at, "`created_at` not defined on "+this);
        return new Date(this.created_at);
    }

    static order() {
        return ['-editing', {to_negate: true, key: created_at__parsed}];
    }

};

Comment.type = 'comment'; // UglifyJS2 mangles class name
export default Comment;

