import assert from 'assert';
import timerlog from 'timerlog';

import LandingPage from './components/pages/landing';
import AuthPage from './components/pages/auth';
import TagPage from './components/pages/tag';
import NotFound404Page from './components/pages/not-found-404';


const page_components = {
    LandingPage,
    AuthPage,
    TagPage,
};
assert(Object.values(page_components).every(component => component.route));
assert(Object.values(page_components).concat(NotFound404Page).every(component => component.get_page_head));

const router = {
    route,
};

export default router;


function route(url_path){
    assert(url_path.constructor===String);

    const matched =
        Object.values(page_components)
        .filter(component => !!component.route.match(url_path))
        .sort((r1, r2) => r2.route._priority - r1.route._priority);

    const component = matched[0] || NotFound404Page;

    const params = component.route && component.route._getParamsObject(url_path) || {};

 // timerlog({tag:'dataflow', message: 'path `'+url_path+'` routed to `'+component.component.displayName+'`'});

    return {
        component,
        params,
    };
}
