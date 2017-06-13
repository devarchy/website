import React from 'react';
import assert_soft from 'assertion-soft';
import route_spec from '../../../util/route_spec';

import Tag from '../../../thing/tag';

import LogoDevarchy from '../../snippets/logo-devarchy';

const LandingPage = props => {
    const TagPage = require('../../pages/tag').default;
    const tag_name = Tag.get_meta_list_name({meta_data: props.meta_data});
    const tag_page = TagPage.element({...props, route: {params: {tag_name}}});
    return (
        <div className="css_page_landing">
            <div className="css_page_landing_content">
                { tag_page }
            </div>
        </div>
    );
};

export default {
    page_route_spec: route_spec.from_crossroads_spec('/'),
    component: LandingPage,
    hide_sidebar: true,
    get_page_head: () => ({title: "Frontend Catalogs", description: "Catalogs of libraries for frontend development."}),
};
