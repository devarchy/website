import React from 'react';

import AuthPage from '../pages/auth';
import LinkMixin from '../mixins/link';


const LoginRequired = React.createClass({
    render: function(){
        if( Thing.things.logged_user ) {
            return null;
        }

        return (
            <div className="css_color_red css_p">
                Log in required
                {' '}
                {this.props.text}
                <br/>
                <LinkMixin.component
                  to={AuthPage.route.interpolate()}
                >
                    <span className="css_color_contrib css_action_text">
                        Log in with GitHub
                    </span>
                </LinkMixin.component>
            </div>
        );
    }
});


export default {
    component: LoginRequired,
};

