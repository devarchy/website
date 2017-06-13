import assert from 'assertion-soft';
import React from 'react';
import classNames from 'classnames';

import Thing from '../../../thing';
import rerender from '../../../rerender';

import ReplyLayoutMixin from '../../mixins/reply-layout';

import UserSnippet from '../../snippets/user';
import {TextButtonSnippet} from '../../snippets/button';
import {DescriptionLineUpvotes, DescriptionLineAge, DescriptionLineAuthor, DescriptionLineEdit} from '../../snippets/description-line';

import GoComment from 'react-icons/lib/go/comment';

import CommentList from './comment-list';

const saving_text = Symbol();


var CommentSnippet = React.createClass({
    render: function(){ 
        const comment = this.props.comment;
        assert(comment.type==='comment');
        assert(comment.votable, comment);
        assert(comment.commentable, comment);

        if( comment.is_new && !comment.is_editing ) {
            return <div/>; //not `null` because of react-flip-move
        }

        return (
            <ReplyLayoutMixin.component
              className="css_comment"
            >
                <ReplyLayoutMixin.component.Header>
                    <div>
                        { ! comment.is_editing && <span style={{wordWrap: 'break-word'}}>{comment.text}</span> }
                        { comment.is_editing && (
                            <textarea
                              rows="3"
                              placeholder={'Comment'}
                              onChange={ev => comment.draft.text = ev.target.value}
                              style={{
                                  width: '100%',
                                  maxWidth: 500,
                              }}
                              className="css_da"
                              defaultValue={comment.draft.text||comment.text}
                              disabled={this.state[saving_text]}
                              autoFocus={true}
                            />
                        ) }
                    </div>
                    { this.render_comment_description_line() }
                    { this.render_comment_edit_buttons() }
                </ReplyLayoutMixin.component.Header>
                { this.render_comment_list() }
            </ReplyLayoutMixin.component>
        );
    }, 
    render_comment_description_line: (() => { 

        const saving_upvote = Symbol();

        return function() {
            const comment = this.props.comment;

            if( comment.is_editing ) {
                return null;
            }

            const user_is_logged = !!Thing.things.logged_user;

            const disabled = this.state[saving_upvote];

            return (
                <fieldset
                  className={classNames(
                    "css_description_line",
                    "css_da",
                    this.state[saving_upvote] && "css_saving"
                  )}
                  disabled={disabled}
                >
                    <DescriptionLineUpvotes thing={comment} />
                    <DescriptionLineAuthor thing={comment} />
                    <DescriptionLineAge thing={comment} />
                    { render_button_upvote(this, disabled) }
                    { render_button_reply(this, disabled) }
                    <DescriptionLineEdit thing={comment} element={this} />
                </fieldset>
            );
        };

        function render_button_upvote(that, disabled) { 
            const comment = that.props.comment;

            if( comment.is_author ) {
                return null;
            }

            const already_upvoted = comment.votable.upvote.user_did();

            return (
                <span className="css_line_component">
                    <TextButtonSnippet
                      is_async={true}
                      onClick={action_toggle_upvote}
                      disabled={disabled}
                      is_pressed={already_upvoted}
                      text={'upvote'}
                    />
                </span>
            );

            function action_toggle_upvote() {
                that.setState({[saving_upvote]: true});
                comment.votable.upvote.toggle()
                .then(() => {
                    that.setState({[saving_upvote]: false});
                    rerender.carry_out();
                });
            }
        } 

        function render_button_reply(that, disabled) { 
            return (
                <span className="css_line_component">
                    <TextButtonSnippet
                      text={'reply'}
                      onClick={() => {
                          that.props.comment.commentable.add_comment();
                          rerender.carry_out();
                      }}
                      disabled={disabled}
                    />
                </span>
            );
        } 
    })(), 
    render_comment_edit_buttons: (() => { 
        return function() {
            if( ! this.props.comment.is_editing ) {
                return null;
            }

            const that = this;

            assert(!!Thing.things.logged_user);

            const disabled = this.state[saving_text];

            return (
                <fieldset
                  className={classNames(
                    "css_description_line",
                    "css_da",
                    this.state[saving_text] && "css_saving"
                  )}
                  disabled={disabled}
                >
                    { render_button_cancel(this, disabled) }
                    { render_button_save(this, disabled) }
                </fieldset>
            );
        };

        function render_button_cancel(that, disabled) { 
            return (
                <span className="css_line_component">
                    <TextButtonSnippet
                      onClick={() => {
                          that.props.comment.is_editing = false;
                          rerender.carry_out();
                      }}
                      disabled={disabled}
                      text={'cancel'}
                    />
                </span>
            );
        } 

        function render_button_save(that, disabled) { 
            return (
                <span className="css_line_component">
                    <TextButtonSnippet
                      is_async={true}
                      text={ that.props.comment.is_new ? 'post' : 'update' }
                      onClick={() => {
                          that.setState({[saving_text]:true});
                          that.props.comment.draft.save()
                          .then(() => {
                              that.props.comment.is_editing = false;
                              that.setState({[saving_text]:false});
                              rerender.carry_out();
                          });
                      }}
                      disabled={disabled}
                    />
                </span>
            );
        } 
    })(), 
    render_comment_list: function() { 
        const comment = this.props.comment;

        const comments = comment.commentable.comments;

        if( comments.length === 0 )
            return null;

        return (
            <ReplyLayoutMixin.component.Replies
              wrapper_key={"comments-for-"+comment.key}
            >
                <CommentList thing={comment} className={"css_comment_replies"} />
            </ReplyLayoutMixin.component.Replies>
        );
    }, 
    getInitialState: () => ({}),
});

export default {
    component: CommentSnippet,
};

