import React from 'react';

import LandingPage from '../pages/landing';


const NotFoundPage = props => (
    <div
      className="css_center"
      style={{
        fontSize: '1.1em',
        height: '100vh',
      }}
    >{
        props.text ||
        'Not Found...'
    }</div>
);


export default {
    component: NotFoundPage,
    get_page_head: () => {
        const pg = LandingPage.get_page_head();
        pg.dont_index = true;
        pg.return_status_code = 404;
        return pg;
    },
};
