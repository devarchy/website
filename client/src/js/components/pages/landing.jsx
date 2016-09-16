import React from 'react';

import crossroads from 'crossroads';


const LandingPage = () =>
    <div className="css_center" style={{fontSize: '1.2em'}}>Select a catalog</div>;


export default {
    route: crossroads.addRoute('/'),
    component: LandingPage,
    get_page_head: () => ({title: "Programming Catalogs"}),
};
