import React from 'react';
import assert_soft from 'assertion-soft';
import classNames from 'classnames';

import {IconAdd, IconAdd2} from '../snippets/icon';
import CollapseMixin from '../mixins/collapse';
import user_tracker from '../../user_tracker';


class CollapsableAdder extends React.Component {
    constructor(props) {
        assert_soft(props.body_content);
        assert_soft(props.header_text);
        super();
        this.state = {expanded: false};
    }
    toggle() {
        const expanded = ! this.state.expanded;

        this.setState({expanded});

        if( this.props.on_toggle ) {
            this.props.on_toggle(expanded);
        }

        if( ! this.props.disable_tracking ) {
            if( expanded ) {
                user_tracker.log_event({
                    category: 'expand `'+this.props.header_text+'`',
                    action: 'NA',
                });
            }
        }
    }
    render() {
        const header = (
            <span
              onClick={this.toggle.bind(this)}
              style={{cursor: 'pointer', transition: 'color .5s', color: this.state.expanded && '#888'}}
              className={!this.state.expanded && "css_tag_color__text"}
            >
                <IconAdd2 className={classNames("css_1px_up css_rotatable", this.state.expanded && "css_rotate_45deg")} />
                {' '}
                {this.state.expanded ? 'Close form' : this.props.header_text}
            </span>
        );

        const body = (
            <CollapseMixin.component isOpened={this.state.expanded}>
                {this.props.body_content}
                <div style={{paddingBottom: 13}}/>
            </CollapseMixin.component>
        );

        return (
            <div
              className={classNames("sel_collapsable_adder", this.props.className)}
              style={this.props.style}
            >
                { header }
                { body }
            </div>
        );
    }
};

export default CollapsableAdder;
