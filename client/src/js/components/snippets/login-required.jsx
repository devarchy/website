import React from 'react';

import Thing from '../../thing';

import AuthPage from '../pages/auth';
import LinkMixin from '../mixins/link';


const LoginRequired = React.createClass({
    render: function(){
        const DEBUG = typeof window !== "undefined" && window.location.host === 'localhost:8082';
        if( Thing.things.logged_user && !DEBUG ) {
            return null;
        }

        return (
            <span
              className={this.props.className}
              style={Object.assign({textDecoration: 'underline'}, this.props.style)}
              children={
                <LinkMixin
                  to={AuthPage.page_route_spec.interpolate_path()}
                  track_info={{action: 'login required text'}}
                >
                    Log in {' '} {this.props.text}
                </LinkMixin>
              }
            />
        );
    }
});


export default {
    component: LoginRequired,
};

