import React from 'react';
import Thing from '../../thing';

const UserSnippet = React.createClass({
    render: function(){
        const thing_user = Thing.things.id_map[this.props.user_id];

        const username = thing_user.user_name;
        const avatar = thing_user.user_image;

        return <div style={{display: 'inline-block'}}>
            { avatar && <div style={{width: 14, height: 14, background: 'url('+avatar+')', backgroundSize: 'contain', backgroundPosition: 'center', display: 'inline-block', verticalAlign: 'middle',}} /> }
            { avatar && ' ' }
            <span style={{verticalAlign: 'middle',}}>{username}</span>
        </div>;
    },
});

export default {
    component: UserSnippet,
};
