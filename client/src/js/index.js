import 'octicons/build/font/octicons.min.css';
import 'react-month-picker/css/month-picker.css';
import 'github-markdown-css/github-markdown.css';
import 'babel-polyfill';
import React from 'react';
import ReactDOM from 'react-dom';
import Promise from 'bluebird';
import timerlog from 'timerlog';
import Progressbar from './components/snippets/progressbar';
import SocialButtonsSnippet from './components/snippets/social-buttons';
/*
import ReactDOMServer from 'react-dom/server';
//*/
import user_tracker from './user_tracker';
import LoadingSnippet from './components/snippets/loading';
import ResourceViewSnippet from './components/snippets/resource-view';
import RenderCanceler from './components/mixins/render-canceler';
import navigation from './navigation.js';
import assert_soft from 'assertion-soft';
import assert from 'assertion-soft';
import Thing from './thing';
import router from './router.js';
import page from './page';
import rerender from './rerender';
import smoothscroll_polyfill from 'smoothscroll-polyfill';
Promise.longStackTraces();
smoothscroll_polyfill.polyfill();


/*
import Perf from 'react-addons-perf';
Perf.start()
setTimeout(() => {
    Perf.stop();
    Perf.printInclusive();
    Perf.printWasted();
    // Perf.printOperations();
}, 6000);
//*/


assert(
    typeof window !== 'undefined',
    [
        'This module coordinates website mutations',
        'It is meant to be run in the browser',
        'It is the entry point for the browser',
    ].join('. '));

// for debugging
window.Thing = Thing;
window.rerender = rerender;

set_hidebar_css_class();

{
    const make = create_make();

    const initial_render_done = {value: false};

    render__on_navigation({make, initial_render_done});

    render__manual_rerender({make, initial_render_done});

    render__initial({make, initial_render_done})
    .then(() => {
        setTimeout(() => {
            user_tracker.install.load_script();
            error_tracker__install();
            SocialButtonsSnippet.install_mounted_buttons();
        }, 100);
    });
}

prevent_scroll_propagation({
    side_areas: ['.css_sidebar', ResourceViewSnippet.scroll_area_selector],
    main_area: '.sel_main_view',
});

user_tracker.install.setup();
user_tracker.log_pageview(navigation.current);
user_tracker.log_pageroute();
user_tracker.trackers.track_page_search();
user_tracker.trackers.track_page_scroll();
user_tracker.trackers.track_visit_count();
user_tracker.trackers.track_bouncing();

export default null;

function render__on_navigation({make, initial_render_done}) { 
    let route__current = router.get_route(navigation.current);

    navigation.on_change = () => {

        const is_handled_by_component = (() => {
            const pathname = navigation.current;
            const route__new = router.get_route(pathname);
            const it_is = (
                route__new.component.route_change_handler &&
                route__new.component === route__current.component &&
                route__new.component.route_change_handler({pathname, params: route__new.params})
            );
            route__current = route__new;
            return it_is;
        })();
        if( is_handled_by_component ) {
            return;
        }

        load_new_page();

    };

    function load_new_page() {
        assert_soft(initial_render_done.value===true);

        Progressbar.start();

        ResourceViewSnippet.hide_view();
        ResourceViewSnippet.clear_cache();

        set_hidebar_css_class();

        make.content.fetch_and_render()
        .then(() => {
            make.tag_list.render();
            Progressbar.done();
            setTimeout(() => {
                SocialButtonsSnippet.install_mounted_buttons();
            }, 1000);
        });

        make.tag_list.render();
        make.logo_section.render();
        make.logo_section_2.render();
     // make.logo_section_eraser.render();

        user_tracker.log_pageroute();
    }
} 

function render__initial({make, initial_render_done}){ 
    const p = (
        make.content.fetch_and_render()
        .then(() => {
            make.tag_list.render();
            make.logo_section.render();
            make.logo_section_2.render();
            initial_render_done.value = true;
            window.document.documentElement.classList.remove('is_loading_initial_data');
            timerlog({tag:'dataflow', message: 'initial render done'});
        })
    );

    make.tag_list.render();
    make.logo_section.render();
    make.logo_section_2.render();
 // make.logo_section_eraser.render();

    return p;
} 

function render__manual_rerender({make, initial_render_done}) { 
    rerender.action = () => {
        assert_soft(initial_render_done.value);
        make.content.render();
        ResourceViewSnippet.clear_cache();
        ResourceViewSnippet.update_view();
        timerlog({tag:'dataflow', message: 're-render all done'});
    };
} 

function create_make() { 
    const make = {};

    let is_fetching_data__counter = 0;

    page
    .sections
    .forEach(page_section => {

        {
            make[page_section.section__name] = (
                {
                    render,
                    fetch_and_render,
                }
            );
        }

        return;

        function fetch_and_render() { 

            const args = get_args();

            const initial_fetch_promise = page.overall.get_initial_fetch_promise(args);

            const node = document.querySelector(page_section.section__node_selector(args));

            const fetch_promise = (() => { 

                if( ! page_section.section__fetch ) {
                    return Promise.resolve();
                }

                const dont_erase_prerendered = (() => {
                    const server_has_rendered = node.innerHTML !=='';
                    return navigation.user_has_not_navigated_yet && server_has_rendered;
                })();

                const fetch_promise = page_section.section__fetch(args);

                assert_soft(fetch_promise, page_section);
                assert_soft(fetch_promise.then, page_section);

                if( ! dont_erase_prerendered ) {
                    if( page_section.section__also_show_when_fetching ) {
                        this.render();
                    }
                    else {
                        ReactDOM.render(
                            React.createElement(LoadingSnippet.component, {scale: 1.5, style: {paddingTop: 50}}),
                            node
                        );
                    }
                }

                return fetch_promise;
            })(); 

            is_fetching_data__counter++;
            return (
                Promise.all([
                    initial_fetch_promise,
                    fetch_promise,
                ])
                .then(() => {
                    this.render();
                })
                .finally(() => {
                    is_fetching_data__counter--;
                })
            );
        } 

        function render() { 
            const args = get_args();

            const page_head = page_section.section__get_page_head(args);
            if( (page_head||{}).title ) {
                document.title = page_head.title;
            }

            const node_selector = page_section.section__node_selector(args);
            const node = document.querySelector(node_selector);

            timerlog({tag:'dataflow', message: 'Render '+node_selector});
            const log_id__element = timerlog({message: 'Create React Element for `#'+node_selector+'`', start_timer: true, tag: 'performance', measured_time_threshold: 5});
         // console.profile("Create React Element for "+node_selector);
            const element = page_section.section__element(args);
         // console.profileEnd();
            timerlog({id: log_id__element, end_timer: true});
            const log_id__render = timerlog({message: '`ReactDOM.render()` for `#'+node_selector+'`', start_timer: true, tag: 'performance', measured_time_threshold: 50});
            assert_soft(element);
            assert_soft(element.type);
            assert_soft(RenderCanceler.displayName);
            assert_soft(RenderCanceler.displayName==='RenderCanceler');
            if( ((element||{}).type||{}).displayName === RenderCanceler.displayName ) {
                return;
            }

            //*/
         // console.profile("Render React Element for "+node_selector);
            //*
            ReactDOM.render(
                element,
                node,
                () => {
                    timerlog({id: log_id__render, end_timer: true});
                 // console.profileEnd();
                }
            );
            //*/
            /*/
            ReactDOMServer.renderToStaticMarkup(element);
            timerlog({id: log_id__render, end_timer: true});
            //*/
        } 

    });

    return make;

    function get_args() { 
        const pathname = navigation.current;
        assert(pathname.constructor===String);

        const hostname = window.location.hostname;
        assert_soft(hostname);

        const is_fetching_data = is_fetching_data__counter>0;
        assert_soft(is_fetching_data__counter>=0);

        return {pathname, hostname, is_fetching_data};
    } 

} 

function error_tracker__install() { 
    if( window.location.hostname === 'localhost' ) {
        return;
    }
    const script = document.createElement('script');
    script.onload = () => {
        window.Raven.config('https://9aa64ec873be44f08b94a0de239ccb98@sentry.io/122314').install()
        timerlog({tag:'dataflow', message: 'error tracking installed'});
     // throw new Error('hello Sentry from browser');
    };
    script.async = true;
    script.crossorigin = "anonymous";
    script.src = "https://cdn.ravenjs.com/3.9.1/raven.min.js";
    document.head.appendChild(script);
} 

function prevent_scroll_propagation({side_areas, main_area}) { 

    main_area = document.querySelector(main_area);
    side_areas = side_areas.map(selector => document.querySelector(selector))
    const html = document.documentElement
    const body = document.body;
    const cl = html.classList;

    disable_protection();

    listeners_add();

    return;

    function listeners_add() {
        listeners_targets('addEventListener');
    }

    function listeners_remove() {
        listeners_targets('removeEventListener');
    }
    function listeners_targets(method) {
        main_area[method]('mouseenter', disable_protection, {passive: true});
        side_areas
        .forEach(scroll_area => {
            scroll_area[method]('mouseenter', enable_protection, {passive: true});
            scroll_area[method]('mouseleave', disable_protection, {passive: true});
            scroll_area[method]('wheel', enable_protection, {passive: true});
        });
        window[method]('touchstart', touch_listener, {passive: true});
    }

    let enabled;
    function enable_protection() {
        if( enabled===true ) return;
        enabled = true;
        const scroll_top = body.scrollTop;
        cl.add('css_prevent_scroll_propagation');
        main_area.scrollTop = scroll_top;
    }
    function disable_protection() {
        if( enabled===false ) return;
        enabled = false;
        const scroll_top = main_area.scrollTop;
        cl.remove('css_prevent_scroll_propagation');
        body.scrollTop = scroll_top;
    }

    function touch_listener() {
        listeners_remove();
        enable_protection();
    }




    /* is jumpy
    const scroll_area__main = document.body;
    let scroll_pos = scroll_area__main.scrollTop;
    let freeze = false;
    window.addEventListener('scroll', function(ev) {
        if( freeze || true) {
            scroll_area__main.scrollTop = scroll_pos;
            return;
        }
        scroll_pos = scroll_area__main.scrollTop;
    }, {passive: true});
    side_areas
    .map(selector => document.querySelector(selector))
    .forEach(scroll_area => {
        scroll_area.addEventListener('wheel', function(ev) {
            if( freeze ) return;
            freeze = setTimeout(() => {freeze = false}, 1000);
        }, {passive: true});
    });
    */



    /* seems to slow down all scrolling including body scrolling
        document.querySelector('.css_sidebar').addEventListener('wheel', function(ev) {
            if(
                ev.deltaY === 0 ||
                ev.deltaY > 0 && (this.scrollHeight - this.scrollTop - this.clientHeight) < 1 ||
                ev.deltaY < 0 && this.scrollTop < 1
            ) {
                ev.preventDefault();
            }
        });
    */
} 

function set_hidebar_css_class() { 
    window.document.documentElement
    .classList[
        page.overall.is_sidebar_hidden(navigation.current)?'add':'remove'
    ]('css_hide_sidebar');
} 
