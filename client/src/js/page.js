import React from 'react';
import assert from 'assert';
import router from './router.js';
import UserInfoSnippet from './components/snippets/userinfo';
import TagListSnippet from './components/snippets/tag-list';
import FooterSnippet from './components/snippets/footer';

// - we need this for sever-side rendering
// - it is the entry point for server-side rendering


const Section = (() => {

    const _component = Symbol();
    const _element = Symbol();
    const _fetch = Symbol();
    const _also_show_when_fetching = Symbol();
    const _get_page_head = Symbol();

    class Section {
        constructor({name, node_id, component, element, fetch, also_show_when_fetching, server_side_render, get_page_head}) {
            assert(node_id);
            assert(component || element && fetch);
            assert(!component || component.component);
            assert(server_side_render.constructor === Boolean);
            assert([Boolean, Function].includes(also_show_when_fetching.constructor));
            this.node_id = node_id;
            this.name = name;
            this.server_side_render = server_side_render;
            this[_component] = component;
            this[_element] = element;
            this[_fetch] = fetch;
            this[_also_show_when_fetching] = also_show_when_fetching;
            this[_get_page_head] = get_page_head;
        }
        element(pathname) {
            const args = get_args(pathname);
            return (
                this[_element] ||
                this[_component].element ||
                React.createElement.bind(React, this[_component].component)
            )(args);
        }
        fetch(pathname) {
            if( this[_fetch] || (this[_component]||{}).fetch ) {
                const args = get_args(pathname);
                return (this[_fetch] || this[_component].fetch)(args);
            }
            return Promise.resolve();
        }
        also_show_when_fetching(pathname) {
            if( [false, true].includes(this[_also_show_when_fetching]) ) {
                return this[_also_show_when_fetching];
            }
            const args = get_args(pathname);
            return this[_also_show_when_fetching](args);
        }
        get_page_head(pathname) {
            const args = get_args(pathname);
            if( !this[_get_page_head] ) {
                return null;
            }
            return this[_get_page_head](args);
        }
    }

    function get_args(pathname) {
        assert(pathname.constructor===String);
        const args = {route: router.route(pathname)};
        assert(args.route.component);
        assert(args.route.params);
        return args;
    }

    return Section;
})();

export default [
    new Section({
        name: 'userinfo',
        node_id: 'js_userinfo',
        component: UserInfoSnippet,
        also_show_when_fetching: true,
        server_side_render: false,
    }),
    new Section({
        name: 'footer',
        node_id: 'js_more',
        component: FooterSnippet,
        also_show_when_fetching: true,
        server_side_render: true,
    }),
    new Section({
        name: 'tag_list',
        node_id: 'js_tag_list',
        component: TagListSnippet,
        also_show_when_fetching: false,
        server_side_render: true,
    }),
    new Section({
        name: 'content',
        node_id: 'js_content',
        element: function({route: {component}}) {
            if( !component.element ) {
                return React.createElement(component.component, null);
            }
            return component.element.apply(component, arguments);
        },
        fetch: function({route: {component}}) {
            if( ! component.fetch ) {
                return Promise.resolve();
            }
            return component.fetch.apply(component, arguments);
        },
        also_show_when_fetching: ({route: {component}}) => component.also_show_when_fetching,
        get_page_head: function({route: {component}}) {
            return component.get_page_head.apply(component, arguments);
        },
        server_side_render: true,
    }),
];
