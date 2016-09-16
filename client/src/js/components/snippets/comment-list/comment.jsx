import assert from 'assert';
import React from 'react';
import classNames from 'classnames';

import pretty_print from '../../../util/pretty_print';

import Thing from '../../../thing';
import rerender from '../../../rerender';

import ReplyLayoutMixin from '../../mixins//reply-layout';
import UserTextMixin from '../../mixins/user-text';

import UserSnippet from '../../snippets/user';
import LoadingSnippet from '../../snippets/loading';

import CommentListSnippet from './comment-list';


var CommentSnippet = React.createClass({
    render: function(){ 
        const thing = this.props.thing;

        assert(thing.votable);
        assert(thing.commentable);

        const className = [
            "user-text",
            this.props.className,
        ].filter(c => c).join(" ");

        if( thing.is_new && !thing.editing ) {
            return <div/>; //not `null` because of react-flip-move
        }

        return (
            <ReplyLayoutMixin.component
              style={this.props.style}
              className={className}
              is_root={thing.type === 'reviewpoint'}
              collapse={this.props.collapse && !thing.editing}
            >
                <ReplyLayoutMixin.component.Header>
                    { this.render_comment() }
                    { this.render_comment_description_line() }
                    { this.render_comment_edit_buttons() }
                </ReplyLayoutMixin.component.Header>
                { this.render_comment_list() }
            </ReplyLayoutMixin.component>
        );
    }, 
    render_comment: function() { 
        const thing = this.props.thing;
        assert(thing.type==='comment');
        return (
            <UserTextMixin.component
              thing={thing}
              className="comment"
              text="Comment"
              ref="usertext"
            >
                <i className={"octicon octicon-comment"} />
            </UserTextMixin.component>
        );
    }, 
    render_comment_description_line: (() => { 

        const saving_upvote = Symbol();

        return function() {
            if( this.props.thing.editing ) {
                return null;
            }

            const user_is_logged = !!Thing.things.logged_user;

            const disabled = this.state[saving_upvote] || !user_is_logged;

            return (
                <fieldset
                  className={classNames(
                    "css_description_line",
                    "css_da",
                    this.state[saving_upvote] && "css_saving"
                  )}
                  disabled={disabled}
                >
                    { render_info(this) }
                    { render_button_upvote(this, disabled) }
                    { render_button_reply(this, disabled) }
                    { render_button_edit(this, disabled) }
                </fieldset>
            );
        };

        function render_info(that) { 
            const thing = that.props.thing;
            assert(!thing.is_new || thing.editing);
            assert(thing.created_at);
            const text_age = pretty_print.age(thing.created_at, {verbose: true})+' ago';
            const text_author = thing.author_name;
            const number_of_upvotes = thing.votable.upvote.number_of();
            const text_upvotes = number_of_upvotes===0 ? '' : (number_of_upvotes+' upvote'+(number_of_upvotes===1?'':'s')+' ');

            return (
                <span>
                    { text_upvotes }{'by '}{ text_author }{' '}{ text_age }
                </span>
            );
        } 

        function render_button_upvote(that, disabled) { 
            const thing = that.props.thing;

            if( is_author(thing) ) {
                return null;
            }

            const already_upvoted = thing.votable.upvote.user_did();

            return (
                <span>
                    <Separator />
                    <button
                      className={classNames(
                        "css_text_button",
                        "css_async_action_button",
                      )}
                      onClick={action_toggle_upvote}
                      disabled={disabled}
                    >
                        <span
                          className={classNames(
                         // !already_upvoted && "css_color_contrib"
                          )}
                        >
                            { already_upvoted ? 'un-' : '' }
                            upvote
                        </span>
                    </button>
                </span>
            );

            function action_toggle_upvote() {
                that.setState({[saving_upvote]: true});
                thing.votable.upvote.toggle()
                .then(() => {
                    that.setState({[saving_upvote]: false});
                    rerender.carry_out();
                });
            }
        } 

        function render_button_reply(that, disabled) { 
            return (
                <span>
                    <Separator />
                    <button
                      className="css_text_button"
                      onClick={add_comment}
                      disabled={disabled}
                    >
                        <span className={classNames(
                          // "css_color_contrib"
                        )}
                        >
                            reply
                        </span>
                    </button>
                </span>
            );
            function add_comment() {
                that.props.thing.commentable.add_comment();
                rerender.carry_out();
            }
        } 

        function render_button_edit(that, disabled) { 
            if( ! is_author(that.props.thing) ) {
                return null;
            }

            return (
                <span>
                    <Separator />
                    <button
                      className="css_text_button"
                      onClick={() => {
                          that.refs['usertext'].edit();
                          that.forceUpdate();
                      }}
                      disabled={disabled}
                    >
                        edit
                    </button>
                </span>
            );
        } 

        function is_author(thing) { 
            return (
                Thing.things.logged_user &&
                thing.author === Thing.things.logged_user.id
            );
        } 
    })(), 
    render_comment_edit_buttons: (() => { 
        const saving_text = Symbol();

        return function() {
            if( ! this.props.thing.editing ) {
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
                <span>
                    <Separator />
                    <button
                      className="css_text_button"
                      onClick={() => {
                          that.refs['usertext'].cancel();
                          that.forceUpdate();
                      }}
                      disabled={disabled}
                    >
                        cancel
                    </button>
                </span>
            );
        } 

        function render_button_save(that, disabled) { 
            return (
                <span>
                    <Separator />
                    <button
                      className="css_text_button css_async_action_button"
                      onClick={() => {
                          that.setState({[saving_text]:true, saving_bs: true});
                          console.log('saving...');
                          that.refs['usertext'].save_text()
                          .then(() => {
                              that.setState({[saving_text]:false});
                              rerender.carry_out();
                          });
                      }}
                      disabled={disabled}
                    >
                        { that.props.thing.is_new ? 'save' : 'update' }
                    </button>
                </span>
            );
        } 
    })(), 
    render_comment_list: function() { 
        const thing = this.props.thing;

        const comments = thing.commentable.comments_all;

        if( comments.length === 0 )
            return null;

        return (
            <ReplyLayoutMixin.component.Replies
              wrapper_key={"comments-for-"+thing.key}
            >
                <div className="recursive-block">
                    <CommentListSnippet.component thing={thing} recursive_call={true} />
                </div>
            </ReplyLayoutMixin.component.Replies>
        );
    }, 
    getInitialState: () => ({}),
});

const Separator = () => <div style={{display: 'inline-block', width: 10, height: 1}}/>;

export default {
    component: CommentSnippet,
};

