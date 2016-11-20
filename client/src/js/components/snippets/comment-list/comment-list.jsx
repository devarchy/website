import assert from 'assert';
import React from 'react';
import CommentSnippet from './comment';
import FlipMove from 'react-flip-move';
// import GoComment from 'react-icons/lib/go/comment';

import rerender from '../../../rerender';

import Thing from '../../../thing';


var CommentListSnippet = React.createClass({
    render: function() {
        const thing = this.props.thing;
        assert(thing.commentable);
        const comments = thing.commentable.comments;

        const user_is_logged = !!Thing.things.logged_user;

        const add_comment_button = ! this.props.recursive_call &&
            <button
              className="css_da css_secondary_button"
              disabled={!user_is_logged || this.props.disable_new_comment}
              onClick={ () => {
                  thing.commentable.add_comment();
               // this.forceUpdate();
                  rerender.carry_out();
              }}
            >
                <i className="octicon octicon-comment" style={{verticalAlign: 'middle', color: '#bbb'}}/>
                {/*
                <GoComment style={{verticalAlign: 'middle', color: '#bbb'}}/>
                */}
                <span className="css_color_contrib_light">
                    {' Add Review'}
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
