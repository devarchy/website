// - we need this for sever-side rendering
// - it is the entry point for server-side rendering

import React from 'react';

import assert from 'assertion-soft';
import assert_soft from 'assertion-soft';
import Promise from 'bluebird';

import router from './router.js';

import Tag from './thing/tag';

import TagListSnippet from './components/snippets/tag-list';
import LogoSectionSnippet from './components/snippets/logo-section';
import EraserSnippet from './components/snippets/eraser';

Promise.longStackTraces();


const Section = (() => { 

    const _node_selector = Symbol();
    const _get_component = Symbol();

    class Section {
        constructor({name, node_selector, component, element, fetch, also_show_when_fetching, server_side_render}) {
            assert(node_selector);
            assert(component);
            assert(component.component || component.element || component.constructor === Function);
            assert(server_side_render.constructor === Boolean);
            assert([Boolean, Function].includes(also_show_when_fetching.constructor));
            this.section__name = name;
            this.section__server_side_render = server_side_render;
            this.section__also_show_when_fetching = also_show_when_fetching;
            this[_node_selector] = node_selector;
            this[_get_component] = function(args) {
                if( component.constructor === Function ) {
                    const ret = component(add_args(args));
                    assert(ret.component || ret.element, ret);
                    assert(!ret.component || ret.component.constructor!==Object, ret);
                    return ret;
                }
                return component;
            };
        }
        section__node_selector(args) {
            return (
                this[_node_selector].constructor === String ? (
                    this[_node_selector]
                ) : (
                    this[_node_selector](add_args(args))
                )
            );
        }
        section__element(args) {
            const component = this[_get_component](args);
            assert(component.component || component.element, component);
            assert(!component.component || component.component.constructor!==Object, component);
            return (
                component.element && component.element.bind(component) ||
                React.createElement.bind(React, component.component)
            )(add_args(args));
        }
        section__fetch(args) {
            const component = this[_get_component](args);
            if( !component.fetch ) {
                return Promise.resolve();
            }
            return component.fetch(add_args(args));
        }
        section__get_page_head(args) {
            const component = this[_get_component](args);
            if( !component.get_page_head ) {
                return null;
            }
            return component.get_page_head(add_args(args));
        }
    }

    function add_args({pathname, hostname, is_fetching_data}) {
        assert_soft((hostname||{}).constructor===String);
        assert_soft((pathname||{}).constructor===String);

        const route = router.get_route(pathname);
        assert_soft(route.component);
        assert_soft(route.component.component || route.component.element);
        assert(!route.component.component || route.component.component.constructor!==Object, route);
        assert_soft(route.params);

        const meta_data = get_meta_data(hostname);

        return {route, pathname, is_fetching_data, meta_data};
    }

    return Section;
})(); 

const sections = (
    [
        new Section({
            name: 'tag_list',
            node_selector: '#js_tag_list',
            component: TagListSnippet,
            also_show_when_fetching: true,
            server_side_render: true,
        }),
        new Section({
            name: 'logo_section',
            node_selector: '#js_logo_section_1',
            component: LogoSectionSnippet,
            also_show_when_fetching: true,
            server_side_render: true,
        }),
        new Section({
            name: 'logo_section_2',
            node_selector: '#js_logo_section_2',
            component: LogoSectionSnippet,
            also_show_when_fetching: true,
            server_side_render: true,
        }),
        /*
        new Section({
            name: 'logo_section',
            node_selector: ({route: {component}}) => component.hide_sidebar ? '#js_logo_section_2' : '#js_logo_section_1',
            component: LogoSectionSnippet,
            also_show_when_fetching: true,
            server_side_render: true,
        }),
        new Section({
            name: 'logo_section_eraser',
            node_selector: ({route: {component}}) => component.hide_sidebar ? '#js_logo_section_1' : '#js_logo_section_2',
            component: EraserSnippet,
            also_show_when_fetching: true,
            server_side_render: true,
        }),
        */
        new Section({
            name: 'content',
            node_selector: '.sel_main_view_content',
            component: ({route: {component}}) => component,
            server_side_render: true,
            also_show_when_fetching: false,
        }),
    ]
);

const get_initial_fetch_promise = (() => {

    let initial_fetch__promise;

    return (
        args => {
            if( ! initial_fetch__promise ) {
                initial_fetch__promise = initial_fetch(args);
            }

            return initial_fetch__promise;
        }
    );

    function initial_fetch({hostname}) {
        const meta_data = get_meta_data(hostname);
        return (
            Promise.all([
                Tag.retrieve_meta_list({meta_data}),
                LogoSectionSnippet.fetch(),
            ])
            .then(() => {})
        );
    }
})();

function get_meta_data(hostname) {
    assert_soft(hostname);

    const sld = (hostname||'').split('.')[0];
    assert_soft(sld);

    const is_programming_stuff = (
        // ['devarchy', 'localhost', ].includes(sld)
        true
    );

    const is_dev = (
        sld==='localhost'
    );

    return {
        is_programming_stuff,
        is_dev,
    };
}

export default {
    overall: {
        get_initial_fetch_promise,
        is_sidebar_hidden,
    },
    sections,
};


function is_sidebar_hidden(pathname) {
    const route = router.get_route(pathname);
    assert_soft(route.component);
    return !!route.component.hide_sidebar;
}
