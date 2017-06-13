import React from 'react';
import ReactCollapse from 'react-collapse';


/*
// works only with react-collapse@1.4.0
const Collapse = React.createClass({
    getInitialState: () => ({never_rendered: true}),
    componentWillReceiveProps: function(nextProps) {
        if( nextProps.isOpened ) {
            this.setState({never_rendered: false});
        }
    },
    render: function(){
        if( this.state.never_rendered ) {
            return null;
        }
        return (
            <ReactCollapse isOpened={this.props.isOpened}>
                {this.props.children}
            </ReactCollapse>
        );
    },
});
*/

// @3.2.0 is buggy
// using @2.3.3 instead
const Collapse = React.createClass({
    getInitialState: function() {
        return {
            never_rendered: !this.props.isOpened,
        };
    },
    componentWillReceiveProps: function(nextProps) {
        if( nextProps.isOpened ) {
            this.setState({never_rendered: false});
        }
    },
    render: function(){
        return (
            <ReactCollapse isOpened={this.props.isOpened} style={this.props.style}>
                {!this.state.never_rendered && this.props.children}
            </ReactCollapse>
        );
    },
});


export default {
    component: Collapse,
};

