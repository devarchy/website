import Thing from './thing.js';
import CommentableMixin from './mixins/commentable';
import VotableMixin from './mixins/votable';

class Comment extends VotableMixin(CommentableMixin(Thing), {author_can_selfvote: false}) {};
Comment.type = 'comment'; // UglifyJS2 mangles class name
Comment.props_immutable = Thing.props_immutable.concat(['referred_resource', 'referred_thing', 'author',]);
Comment.props_required = Comment.props_immutable;
export default Comment;
