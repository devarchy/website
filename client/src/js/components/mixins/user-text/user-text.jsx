import assert from 'assert';
import React from 'react';
import classNames from 'classnames';

import Thing from '../../../thing';

import LoadingSnippet from '../../snippets/loading';


const UserTextMixin = React.createClass({
    render: function(){ 
        const thing = this.thing = this.props.thing;

        const that = this;

        assert(thing.votable);
        assert(thing.commentable);

        const className = [
            "user-text",
            this.props.className,
        ].filter(c => c).join(" ");

        return (
            <div>
                { render_header() }
                { render_textareas() }
            </div>
        );

        function render_header() {
            if( thing.editing ) {
                return null;
            }

            return (
                <span>
                    { thing.editing ? thing.draft.text : thing.text }
                </span>
            );
        }

        function render_textareas() {
            if( ! thing.editing )
                return null;

            return <div>
                { that.state.validation_text_missing && <span className="color-red">{that.props.text} cannot be empty</span> }
                <textarea
                  autoFocus
                  defaultValue={thing.draft.text}
                  rows="3"
                  style={{width: '100%', maxWidth: 500}}
                  onChange={change_text}
                  placeholder={that.props.text}
                />
            </div>;
        }

        function change_text(event){
            thing.draft.text = event.target.value;
            /*
            clearInterval(that.update_timeout);
            that.update_timeout = setTimeout( () => {
                that.forceUpdate();
            },500);
            */
        }
    }, 
    edit: function(){ 
        assert( Thing.things.logged_user );
        this.thing.draft.author = Thing.things.logged_user.id;
        this.thing.draft.text = this.thing.text;
        this.thing.editing = true;
        this.forceUpdate();
    }, 
    save_text: function(){ 
        const validation_text_missing = ! this.thing.draft.text;
        this.setState({validation_text_missing});
        if( validation_text_missing ) {
            return;
        }
        const that = this;
        return do_save();

        function do_save() { 
            return (
                that.thing.draft.save()
            )
            .then(() => {
                that.thing.editing = false;
                that.forceUpdate();
            });
        } 
    }, 
    cancel: function(){ 
        this.thing.editing = false;
        this.forceUpdate();
    }, 
    getInitialState: function() { 
        return {
            validation_text_missing: false,
        };
    }, 
});


export default {
    component: UserTextMixin,
};
