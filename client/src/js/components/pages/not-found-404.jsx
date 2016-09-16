import React from 'react';

import LandingPage from '../pages/landing';


const NotFoundPage = props =>
    <div className="css_center" style={{fontSize: '1.1em'}}>{props.text || 'Not Found...'}</div>;


export default {
    component: NotFoundPage,
    get_page_head: LandingPage.get_page_head,
};
