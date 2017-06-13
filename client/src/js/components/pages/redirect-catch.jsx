import React from 'react';
import assert_soft from 'assertion-soft';

import route_spec from '../../util/route_spec';
import NotFoundPage from '../pages/not-found-404';
import TagResourcePage from '../pages/tag-resource';
import NeedsAndLibsPage from '../pages/needs-and-libs';


const RedirectCatchPage = ({pathname}) => {
    if( typeof window !== "undefined" ) {
        const redirect_to = get_redirect_to(pathname);
        assert_soft(false, 'client-side redirection to '+redirect_to, pathname, window.location.href);
        if( assert_soft((pathname||'').startsWith('/'), pathname) ) {
            if( assert_soft(redirect_to, pathname) ) {
                setTimeout(() => {
                    const navigation = require('../../navigation').default;
                    navigation.navigate_to(redirect_to);
                }, 2000);
                return (
                    <NotFoundPage.component text={'You will be redirected in a moment.'} />
                );
            }
        }
    }

    return (
        <NotFoundPage.component text={'Something went wrong; You should have been redirected.'}/>
    );
};


export default {
    page_route_spec: route_spec({
        path_is_matching: ({pathname}) => !!get_redirect_to(pathname),
        interpolate_path: () => {assert_soft(false);},
        get_route_pattern: () => '/{redirected-route}',
        get_route_params: () => ({}),
    }),
    component: RedirectCatchPage,
    hide_sidebar: true,
    get_page_head: ({pathname}) => {
        const pg = NotFoundPage.get_page_head();
        const redirect_to = get_redirect_to(pathname);
        assert_soft(redirect_to, pathname);
        if( redirect_to ) {
            pg.redirect_to = redirect_to;
            pg.return_status_code = 301;
        }
        return pg;
    },
};


function get_redirect_to(pathname) {
    if( ! assert_soft((pathname||1).constructor===String, pathname) ) return null;

    const REDIRECTS = Object.entries({
        '/react-components': '/react',
        '/angular-components': '/angular',
        '/frontend-libraries': '/frontend',
        '/redirect-test-1': '/redirect-test-2',
    });


    for(const [source, target] of REDIRECTS) {
        const directory = (() => {
            if( ! TagResourcePage.page_route_spec.path_is_matching({pathname}) ) {
                return '';
            }
            if( ! NeedsAndLibsPage.page_route_spec.path_is_matching({pathname: target}) ) {
                return '';
            }
            const tag_page_params = TagResourcePage.page_route_spec.get_route_params({pathname});
            if( tag_page_params.tag_name !== source.slice(1) || !tag_page_params.resource_human_id ) {
                return '';
            }
            return '/library';
        })();
        if( pathname.startsWith(source) ) {
            return target+directory+pathname.slice(source.length);
        }
    }

    return null;
}


