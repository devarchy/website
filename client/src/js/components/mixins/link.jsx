import React from 'react';
import classNames from 'classnames';
import assert_soft from 'assertion-soft';

import user_tracker from '../../user_tracker';
import router from '../../router';


const HttpLink = ({url, text, empty_text, alt, children, give_page_rank, ...props}) => {

    assert_soft(!props.href, props.href);
    assert_soft(url, url);
    assert_soft(url.startsWith('http://') || url.startsWith('https://'), url);

    if( children && children.constructor === String ) {
        text = children;
        children = undefined;
    }

    const url_pretty = (() => {
        assert_soft(!(children && text));
        if( children ) {
            return children;
        }
        if( text ) {
            return text;
        }
        if( empty_text ) {
            return null;
        }
        return prettify_url(url);
    })();

    assert_soft(!empty_text === !!url_pretty);

    const onClick_org = props.onClick;
    delete props.onClick;

    const track_info = Object.assign({}, props.track_info);
    delete props.track_info;

    let dom_el;

    return (
        <a
            href={url}
            className={children ? "css_da" : "css_a_gray"}
            rel={give_page_rank ? null : 'nofollow'}
            alt={alt}
            ref={dom_el_ => {
                dom_el = dom_el_;
            }}
            target="_blank"
            onClick={onClick}
            onContextMenu={onContextMenu}
            {...props}
        >
            {url_pretty}
        </a>
    );

    function onClick(event) {
        if( onClick_org ) {
            onClick_org.apply(this, arguments);
        }
        onClickFollow(event);
    }

    function onContextMenu(event) {
        onClickFollow(event, {is_context_menu: true});
    }

    function onClickFollow(event, {is_context_menu}={}) {
        track(event, {is_context_menu});
    }
    function track(event, {is_context_menu}={}) {
        const additional_info = {
            text: dom_el.textContent,
            link_target: url,
        };
        const modifiers = ['alt', 'ctrl', 'meta', 'shift'].filter(k => event[k+'Key']);
        additional_info.modifiers = modifiers.join(',') || 'none';
        additional_info.is_context_menu = is_context_menu?'yes':'no';
        if( track_info.additional_info ) {
            Object.assign(additional_info, track_info.additional_info),
            delete track_info.additional_info;
        }
        user_tracker.log_event(
            Object.assign(
                {
                    category: 'URL Link [external]',
                    action: url,
                    additional_info,
                },
                track_info
            )
        );
    }

};

const RouteLink = ({on_link_click, onClick, to, dont_track, track_info, style, className, text, dont_give_page_rank, children}) => {

    return (
        <a
          style={style}
          className={className || "css_da"}
          rel={dont_give_page_rank ? 'nofollow' : null}
          href={get_href(to)}
          onClick={_onClick}
          onContextMenu={onContextMenu}
        >
            {text}
            {children}
        </a>
    );

    function _onClick (event) { 
        // dynamically load navigation module because of server side react rendering
        const navigation = require('../../navigation').default;

        const modifiers = ['alt', 'ctrl', 'meta', 'shift'].filter(k => event[k+'Key']);

        let prevented__by_modifier = modifiers.length > 0;
        let prevetend__by_listener;

        if( on_link_click ) {
            on_link_click({
                modifiers
            });
        }

        if( onClick ) {
            const ret = onClick({
                preventDefault: () => prevetend__by_listener = true,
                same_page: to === navigation.current,
                modifiers,
                event__original: event,
            });
            prevetend__by_listener = prevetend__by_listener || ret;
        }

        if( !dont_track && !prevetend__by_listener ) {
            track(event, {modifiers});
        }

        if( prevented__by_modifier ) {
            return;
        }

        event.preventDefault();

        if( prevetend__by_listener) {
            return;
        }

        navigation.navigate_to(to);
    } 

    function onContextMenu(event) {
        track(event, {is_context_menu: true});
    }

    function track(event, {is_context_menu, modifiers}={}) {
        const link_target = to;
        const link_target_route = router.get_pattern(link_target);
        assert_soft(link_target_route, to);
        const action = link_target_route;
        const additional_info = {
            link_target,
            link_target_route,
        };
        additional_info.modifiers = modifiers && modifiers.join(',') || 'none';
        additional_info.is_context_menu = is_context_menu?'yes':'no';
        user_tracker.log_event(
            Object.assign(
                {
                    category: 'URL Link [internal]',
                    action,
                    additional_info,
                },
                track_info
            )
        );
    }

    function get_href(href) { 
        const dev_domain = 'http://localhost:8082';
        if( typeof window !== "undefined" && window.location.origin === dev_domain ) {
            if( href.startsWith(dev_domain+'/') ) {
                href = href.replace(dev_domain+'/', dev_domain+'/#/');
            }
            if( href.startsWith('/') ) {
                href = '#'+href;
            }
        }
        return href;
    } 
};

const LinkMixin = props => {
    const IS_INTERNAL = !!props.to;
    (
        IS_INTERNAL ? [
            'give_page_rank',
            'url',
        ] : [
            'dont_give_page_rank',
            'to',
        ]
    )
    .forEach(prop => {
        assert_soft(!(prop in props), props, prop);
    });

    assert_soft(props.track_info===undefined || props.track_info && props.track_info.constructor===Object, props.track_info);

    if( IS_INTERNAL ) {
        return <RouteLink {...props} />;
    }
    assert_soft(props.url, props);
    return <HttpLink {...props} />;
};

function prettify_url(url) {
    let url_pretty = url;
    url_pretty = url_pretty.replace(/^https?:\/\//,'');
    url_pretty = url_pretty.replace(/^www\./,'');
    url_pretty = url_pretty.replace(/\/$/,'');
    return url_pretty;
}

export {LinkMixin, prettify_url, LinkMixin as default};
