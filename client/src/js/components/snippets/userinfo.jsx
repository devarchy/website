import React from 'react';
import assert from 'assert';
import Thing from '../../thing';
import UserSnippet from './user';

const LoginButton = () =>
    <a href="/auth/github" className="css_da">
        <button className="css_da css_primary css_login_button">
            <span
              style={{fontSize: '0.95rem', wordSpacing: '1px'}}
              className="css_color_contrib"
            >
                Log in with
                GitHub
                {' '}
                <i
                className="fa fa-github"
                style={{color: '#6d6d6d', fontSize: '1.3em', verticalAlign: 'middle', position: 'relative', top: -1, left: -2}}
                />
            </span>
            <div
              style={{fontSize: '0.78rem', textTransform: 'none', letterSpacing: 'normal', color: '#656565'}}
            >
                no permissions asked
            </div>
        </button>
    </a>;

const UserinfoSnippet = React.createClass({
    render: function(){
        const logged_user = Thing.things.logged_user;

        if( is_loading === true ) {
            return null;
        }

        if( ! logged_user ) {
            return <LoginButton />
        }

        assert( logged_user.id );

        return <UserSnippet.component user_id={logged_user.id} />;
    }
});

let is_loading = false;

export default {
    component: UserinfoSnippet,
    fetch: () => {
        assert(!is_loading);
        is_loading = true;
        return (
            Thing.load.logged_user()
        ).then(() => {
            is_loading = false
        });
    },
};
