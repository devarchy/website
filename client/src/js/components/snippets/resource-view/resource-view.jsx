import React from 'react';
import ReactDOM from 'react-dom';
import assert from 'assertion-soft';
import assert_soft from 'assertion-soft';

import ResourceDetailsSnippet from '../../snippets/resource-details';
import LoadingSnippet from '../../snippets/loading';
import {IconClose} from '../../snippets/icon';

import Resource from '../../../thing/resource';
import Tag from '../../../thing/tag';

import user_tracker from '../../../user_tracker';

import ClickOutside from 'react-click-outside';


let view_last;
const ResourceViewSnippet = props => { 
    const {is_loading, resource, tag} = props;

    if( is_loading ) {
        return (
            <LoadingSnippet.component center_loader={true} scale={1.5}/>
        );
    }

    assert_soft(resource);
    assert_soft(tag);

    return (
        <ClickOutside
            onClickOutside={ev => {

                {
                    assert_soft(ev.target);
                    const SELECTOR = '.css_resource';
                    if( has_parent(ev.target, SELECTOR) ) {
                        return;
                    }
                }


                const time_since_last_opening =  new Date().getTime() - (last_opening||0);
                if( time_since_last_opening > 500 ) {
                    const did_something = hide_view({click_event: ev});
                    if( did_something ) {
                        if( assert_soft(view_last) ) {
                            if( assert_soft(view_last.resource_name) ) {
                                user_tracker.log_event({
                                    category: 'close resource view [via click outside]',
                                    action: view_last.resource_name,
                                });
                            }
                        }
                    }
                }

                return;

                let limit;
                function has_parent(el, css_selector) {
                    limit = (limit||0)+1;
                    if( ! assert_soft(limit<1000) ) {
                        return false;
                    }
                    if( !el ) {
                        return false;
                    }
                    const test_method = el.matches || el.matchesSelector;
                    if( ! assert_soft(test_method) ) {
                        return false;
                    }
                    if( test_method.call(el, css_selector) ) {
                        return true;
                    }
                    return has_parent(el.parentElement, css_selector);
                }
            }}
        >
            <div
              key={resource.id}
              ref={dom_el => {
                if( ! dom_el ) {
                    return;
                }
                if( typeof window === "undefined" ) {
                    assert_soft(false);
                    return;
                }
                if( (view_last||{}).id !== resource.id ) {
                    window.document.querySelector(scroll_area_selector).scrollTop = 0;
                    view_last = resource;
                }
              }}
            >
                <ResourceDetailsSnippet.component resource={resource} tag={tag} {...props}/>
            </div>
        </ClickOutside>
    );
}; 

const scroll_area_selector = '.sel_resource_view__scroll_area';
let view_cache = {};
let view_current;

export default {
    toggle_resource,
    hide_view,
    update_view,
    clear_cache,
    scroll_area_selector,
    get_main_content_scroll_area,
};

function toggle_resource(props) { 
    if( typeof window === "undefined" ) {
        assert_soft(false);
        return;
    }
    get_hook_node();

    const {resource_id} = props;

    assert_soft(resource_id, resource_id);

    if( view_current && view_current.resource_id === resource_id ) {
        hide_view({click_event: props.click_event});
        return true;
    }

    view_current = Object.assign({}, props);

    if( view_cache[resource_id] ) {
        ReactDOM.render(view_cache[resource_id], dom_hook_node);
        show_view({click_event: props.click_event});
        return false;
    }

    setup_close_button_up();

    ReactDOM.render(
        React.createElement(ResourceViewSnippet, {is_loading: true}),
        dom_hook_node
    );

    show_view({click_event: props.click_event});

    ResourceDetailsSnippet.fetch({resource_id})
    .then(() => {
        assert_soft(resource_id===props.resource_id, resource_id, props.resource_id);
        view_cache[resource_id] = _create_element(props);
        if( (view_current||{}).resource_id === resource_id ) {
            _render();
        }
    });

    return false;
} 

function update_view() { 
    const resource_id = (view_current||{}).resource_id;
    if( ! resource_id ) {
        return;
    }
    view_cache[resource_id] = _create_element(view_current);
    _render();
} 

let dom_hook_node;
function get_hook_node() {
    dom_hook_node = dom_hook_node || window.document.querySelector('.sel_resource_view__scroll_area');
}

const CSS_SHOW_RESOURCE_VIEW = 'css_show_resource_view';
let is_showing;
let last_opening;
function show_view({click_event}={}) {
    if( is_showing ) {
        return false;
    }
    const cl = document.documentElement.classList;
    if( !assert_soft(!cl.contains(CSS_SHOW_RESOURCE_VIEW), 'removing class somewhere else?') ) {
        return;
    }
    last_opening = new Date().getTime();
    is_showing = true;
    cl.add(CSS_SHOW_RESOURCE_VIEW);
    return true;
}
function hide_view({click_event}={}) {
    if( ! is_showing ) {
        return false;
    }
    const cl = document.documentElement.classList;
    if( !assert_soft(cl.contains(CSS_SHOW_RESOURCE_VIEW), 'adding class somewhere else?') ) {
        return;
    }
    is_showing = false;
    view_current = null;
    cl.remove(CSS_SHOW_RESOURCE_VIEW);
    return true;
}

function _create_element(props) {
    assert_soft(props.resource_id);
    assert_soft(props.tag_name);
    const resource = Resource.get_by_id(props.resource_id);
    const tag = Tag.get_by_name(props.tag_name);
    assert_soft(resource);
    assert_soft(tag);

    return (
        React.createElement(
            ResourceViewSnippet,
            Object.assign({}, props, {resource, tag})
        )
    );
}

function _render(element) {
    const resource_id = (view_current||{}).resource_id;
    assert_soft(view_cache[resource_id], view_cache, resource_id);
    if( ! resource_id || ! view_cache[resource_id] ) {
        return;
    }
    ReactDOM.render(view_cache[resource_id], dom_hook_node);
}

function clear_cache() {
    view_cache = {};
}

let close_btn;
function setup_close_button_up() {
    close_btn = close_btn || window.document.querySelector('.sel_resource_view__close_button');
    if( ! assert_soft(close_btn) ) return;
    if( close_btn.onclick ) {
        return;
    }
    close_btn.onclick = ev => {
        hide_view({click_event: ev});
        if( ! assert_soft(view_last, view_cache, view_current, last_opening, is_showing, !!dom_hook_node) ) return;
        user_tracker.log_event({
            category: 'close resource view [via cross button]',
            action: view_last.resource_name,
        });
    };
    ReactDOM.render(<IconClose/>, close_btn);
}
function get_main_content_scroll_area() {
    const body = document.body;
    const content = document.querySelector('.sel_main_view');
    if( content.scrollHeight > body.scrollHeight ) {
        return content;
    }
    return body;
}
