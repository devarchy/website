import React from 'react';
import Thing from '../../thing';

const UserSnippet = React.createClass({
    render: function(){
        const thing_user = Thing.things.id_map[this.props.user_id];

        const username = thing_user.github_info.login;
        const avatar_url = thing_user.github_info.avatar_url;

        return <div style={{display: 'inline-block'}}>
            { avatar_url && <img width="16" height="16" src={avatar_url} href={avatar_url} /> }
            { avatar_url && ' ' }
            <span>{username}</span>
        </div>;
    },
});

export default {
    component: UserSnippet,
};
