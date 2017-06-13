import React from 'react';
import assert from 'assertion-soft';
import assert_soft from 'assertion-soft';

import classNames from 'classnames';

import Thing from '../../../thing';
import rerender from '../../../rerender';
import user_tracker from '../../../user_tracker';

import {IconButton} from '../../snippets/button';


const Ib = ({children, className, style}) =>
    <div style={Object.assign({display: 'inline-block', verticalAlign: 'middle'}, style)} className={className}>
        {children}
    </div>;

class VoteButton extends React.Component {
    constructor(props) {
        super(props)
        assert(this.props.spec);
    }
    render() {
        assert(false); // VoteButton components are just placeholders
    }
}

class VoteBlock extends React.Component {
    constructor(props) {
        super(props)
        assert(this.props.thing);
        this.state = {saving_vote: null};
    }
    render() {
        const is_saving = this.state.saving_vote!==null;

        return (
            <fieldset
              className={classNames({
                "css_saving": is_saving,
                "css_da": true,
              })}
              style={Object.assign({display: 'inline-block'}, this.props.style)}
            >
                { (this.props.spec||[]).map(spec => render_button.call(this, {spec})) }
                {
                    (this.props.children||[]).map( child => {
                        return (
                            child.type!==VoteButton ?
                                child :
                                render_button.call(this, child.props)
                        );
                    })
                }
            </fieldset>
        );

        function render_button({spec: {is_negative, vote_type, text, icon}, style, desc_text}) {
            const already_voted = this.props.thing.votable[vote_type].user_did({is_negative});

            assert(icon);

            const disabled = is_saving || !Thing.things.logged_user;

            const key = [vote_type, is_negative].join('-');

            const btn = (
                <IconButton
                  is_pressed={already_voted}
                  is_async={this.state.saving_vote===is_negative}
                  onClick={onclick.bind(this)}
                  disabled={disabled}
                  style={style}
                  key={key}
                  icon={icon}
                  alt={text}
                  text={desc_text}
                />
            );

            return btn;

            function onclick() {
                if( disabled ) { return; }
                const thing = this.props.thing;
                this.setState({
                    saving_vote: is_negative,
                });
                thing.votable[vote_type].toggle({is_negative})
                .then(() => {
                    this.setState({
                        saving_vote: null,
                    });
                    rerender.carry_out();
                });
                {
                    let category = is_negative ? 'Downvote' : 'Upvote';
                    if( already_voted ) {
                        category = 'Un-'+category;
                    }
                    assert_soft(thing.type==='resource');
                    user_tracker.log_event({
                        category,
                        action: thing.resource_name || thing.id,
                    });
                }
            }
        }
    }
};

export {VoteButton, VoteBlock, VoteBlock as default};
