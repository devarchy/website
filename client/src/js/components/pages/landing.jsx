import React from 'react';

import crossroads from 'crossroads';

import NotFound404Page from '../pages/not-found-404';


const LandingPage = () =>
    <NotFound404Page.component text={'Select a list'} />;


export default {
    route: crossroads.addRoute('/'),
    component: LandingPage,
    get_page_head: () => ({title: "Curated Lists"}),
};
