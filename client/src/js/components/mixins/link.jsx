import React from 'react';

const LinkMixin = React.createClass({
    clickHandler: function(event){

        // dynamically load navigation module because of server side react rendering
        const navigation = require('../../navigation').default;

        if ( ['alt', 'ctrl', 'meta', 'shift'].some(k => event[k+'Key']) ) {
            return;
        }

        event.preventDefault();

        if( (this.props.interceptor || (() => {}))(this.props.to === navigation.current) ) return;

        navigation.navigate(this.props.to);

    },
    render: function(){
        return (
            <a
              style={this.props.style}
              className={this.props.className}
              href={this.props.to}
              onClick={this.clickHandler}
            >
                {this.props.children}
            </a>
        );
    },
});

export default {
    component: LinkMixin,
};
