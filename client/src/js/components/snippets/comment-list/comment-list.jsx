import assert from 'assert';
import React from 'react';
import CommentSnippet from './comment';
import FlipMove from 'react-flip-move';

import rerender from '../../../rerender';

import Thing from '../../../thing';


var CommentListSnippet = React.createClass({
    render: function() {
        const thing = this.props.thing;
        assert(thing.commentable);
        const comments = thing.commentable.comments_all;

        const user_is_logged = !!Thing.things.logged_user;

        const add_comment_button = ! this.props.recursive_call &&
            <button
              className="css_da css_secondary_button"
              disabled={!user_is_logged}
              onClick={ () => {
                  thing.commentable.add_comment();
                  this.forceUpdate();
              }}
            >
                <i style={{verticalAlign: 'middle', color: '#bbb'}} className="octicon octicon-comment"/>
                <span className="css_color_contrib_light">
                    {' Add Comment'}
                </span>
            </button>;

        return (
            <div>
                <FlipMove enterAnimation="none" leaveAnimation="none" className="comment-list">{
                    comments.map(comment =>
                        <CommentSnippet.component
                          key={comment.key}
                          thing={comment}
                        />)
                }</FlipMove>
                { add_comment_button }
            </div>
        );
    },
}); 

export default {
    component: CommentListSnippet,
};
