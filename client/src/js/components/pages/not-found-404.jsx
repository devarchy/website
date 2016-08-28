import React from 'react';

const NotFoundPage = props =>
    <div className="css_center" style={{fontSize: '1.1em'}}>{props.text || 'Not Found...'}</div>;

export default {
    component: NotFoundPage,
};
