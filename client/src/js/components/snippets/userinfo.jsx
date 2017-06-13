import React from 'react';
import assert from 'assertion-soft';
import Promise from 'bluebird';
import Thing from '../../thing';

import AuthPage from '../pages/auth';
import UserSnippet from '../snippets/user';
import {BigButtonSnippet} from '../snippets/button';

import GoMarkGithub from 'react-icons/lib/go/mark-github';
Promise.longStackTraces();


const LoginButton = () =>
    <BigButtonSnippet
      link={AuthPage.page_route_spec.interpolate_path()}
      style={{backgroundColor: 'rgba(0,0,0, 0.02)', paddingTop: 3, paddingBottom: 1, paddingLeft: 10, paddingRight: 9, marginBottom: 4}}
    >
        <span
          style={{fontSize: '0.95rem', wordSpacing: '1px', color: '#666'}}
        >
            Login
        </span>
    </BigButtonSnippet>

const UserinfoSnippet = React.createClass({
    render: function(){
        const logged_user = Thing.things.logged_user;

        // we need this because we render the logo section while fetching
        if( this.props.is_fetching_data ) {
            return null;
        }

        if( ! logged_user ) {
            return <LoginButton />
        }

        assert( logged_user.id );

        return <UserSnippet.component user_id={logged_user.id} />;
    }
});

export default {
    component: UserinfoSnippet,
    fetch: () => {
        if( typeof window === "undefined" ) {
            return Promise.resolve();
        }
        return (
            Thing.load.logged_user()
            .then(() => {})
        );
    },
};
