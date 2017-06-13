import assert from 'assertion-soft';
import timerlog from 'timerlog';
import assert_soft from 'assertion-soft';

import NotFound404Page from './components/pages/not-found-404';
import LandingPage from './components/pages/landing';
import AuthPage from './components/pages/auth';
import TagPage from './components/pages/tag';
import TagResourcePage from './components/pages/tag-resource';
import AboutPage from './components/pages/about';
import RedirectCatchPage from './components/pages/redirect-catch';
import NeedsAndLibsPage from './components/pages/needs-and-libs';


const all_pages = [
    LandingPage,
    AuthPage,
    AboutPage,
    RedirectCatchPage,
    NeedsAndLibsPage,
    TagPage,
    TagResourcePage,
];
assert(all_pages.every(component => !!component.page_route_spec.path_is_matching));
assert(all_pages.concat(NotFound404Page).every(component => !!component.get_page_head));

const router = {
    get_route,
    get_pattern,
};

export default router;


function get_route(pathname){
    assert((pathname||0).constructor===String, pathname);

    const component = (
        all_pages.find(component => component.page_route_spec.path_is_matching({pathname}))
        || NotFound404Page
    );

    const params = (component.page_route_spec||{}).get_route_params && component.page_route_spec.get_route_params({pathname}) || {};

 // timerlog({tags:['client', 'dataflow'], message: 'path `'+pathname+'` routed to `'+component.component.displayName+'`'});

    return {
        component,
        params,
    };
}


function get_pattern(pathname) {
    const route = router.get_route(pathname);
    if( assert_soft(route, pathname) ) {
        const component = route.component;
        if( assert_soft(component, route) ) {
            const route_spec = component.page_route_spec;
            if( assert_soft(route_spec, component) ) {
                const pattern = route_spec.get_route_pattern();
                assert_soft(pattern, route_spec);
                return pattern;
            }
        }
    }
    return null;
}
