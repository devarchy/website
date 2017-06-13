import React from 'react';
import classNames from 'classnames';

import Thing from '../../../thing';
import user_tracker from '../../../user_tracker';

import UserInfoSnippet from '../../snippets/userinfo';
import LogoDevarchy from '../../snippets/logo-devarchy';

import TagResourcePage from '../../pages/tag-resource';
import LandingPage from '../../pages/landing';
import AboutPage from '../../pages/about';

import LinkMixin from '../../mixins/link';

import assert_soft from 'assertion-soft';

import {IconCatalogList, IconAbout, IconSourceCode, IconFeedback, IconChat} from '../../snippets/icon';


class LogoSectionSnippet extends React.Component {
    constructor(props) {super(props);}
    componentDidMount() {
        elements.push(this);
        /*
        if( cursor_tracker.mouse_is_hovering_element(this.dom_el) ) {
            update_open_state(true);
        }
        */
    }
    componentWillUnmount() {
        assert_soft(false);
    }
    onMouseEnter(ev) {
        user_tracker.trackers.track_logo_hover({on_mouse_enter: true});
        /*
        if( ev.pageX === 0 && ev.pageY === 0 ) {
            // fixes chrome bug when tabbing back-and-forth
            return;
        }
        */
        update_open_state(true);
    }
    onMouseLeave(ev) {
        user_tracker.trackers.track_logo_hover({on_mouse_leave: true});
        /*
        if( assert_soft(this.dom_el) && cursor_tracker.mouse_is_hovering_element(this.dom_el) ) {
            return;
        }
        */
        update_open_state(false);
    }
    render() {
        return (({route: {component}}) => {

            const section_userinfo = <UserInfoSnippet.component/>;

            const section_logged_username = Thing.things.logged_user && <div style={{marginTop: 5}}>{section_userinfo}</div>;

            const section_login_button = !Thing.things.logged_user && <div style={{marginTop: 5, marginBottom: 4}}>{section_userinfo}</div>;

            const link_feedback = ( 
                <LinkMixin
                  url="https://github.com/devarchy/website/issues"
                  style={{display: 'block'}}
                  text={
                    <span>
                        <IconFeedback />
                        {' '}
                        Feedback
                    </span>
                  }
                />
            ); 

            const link_chat = ( 
                <LinkMixin
                  url="https://gitter.im/devarchy-project/Lobby"
                  style={{display: 'block'}}
                  text={
                    <span>
                        <IconChat />
                        {' '}
                        Chat
                    </span>
                  }
                />
            ); 

            const link_code = ( 
                <LinkMixin
                  url="https://github.com/devarchy/website"
                  style={{display: 'block'}}
                  text={
                    <span>
                        <IconSourceCode />
                        {' '}
                        Source code
                    </span>
                  }
                />
            ); 

            const link_all_lists = ( 
                <LinkMixin
                  to={LandingPage.page_route_spec.interpolate_path()}
                  track_info={{action: '`All catalogs` menu item'}}
                  style={{display: 'block'}}
                  text={
                    <span>
                        <IconCatalogList />
                        {' '}
                        All catalogs
                    </span>
                  }
                />
            ); 

            const link_vision = ( 
                <LinkMixin
                  to={AboutPage.page_route_spec.interpolate_path()}
                  style={{display: 'block'}}
                  text={
                    <span>
                        <IconAbout />
                        {' '}
                        About
                    </span>
                  }
                />
            ); 

            const that = this;
            return (
                <div
                  onMouseLeave={this.onMouseLeave.bind(this)}
                  ref={dom_el => this.dom_el = dom_el}
                  className={classNames("css_logo_section", menu_is_opened && "css_expand")}
                  style={{
                    // fixes chrome bug that wrongly sets the mouse at position (0,0) upon tabbing
                    marginTop: 1,
                  }}
                >
                    <LinkMixin
                      to={LandingPage.page_route_spec.interpolate_path()}
                      track_info={{action: 'Devarchy logo'}}
                    >
                        <div className="css_logo_wrapper"
                          onMouseEnter={this.onMouseEnter.bind(this)}
                        >
                            <LogoDevarchy />
                        </div>
                    </LinkMixin>
                    <div
                      className={"css_logo_menu"}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                        <div>
                            { section_login_button }
                        </div>
                        <div className="css_logo_links">
                            {/*
                            { link_all_lists }
                            { link_chat }
                            */}
                            { link_feedback }
                            { link_code }
                            { link_vision }
                            { section_logged_username }
                        </div>
                    </div>
                </div>
            );
        })(this.props);
    }
};

let menu_is_opened = false;
const elements = [];
function update_open_state(new_state) {
    if( menu_is_opened === new_state ) {
        return;
    }
    menu_is_opened = new_state;
    elements.forEach(el => el.forceUpdate());
}

export default {
    component: LogoSectionSnippet,
    fetch: UserInfoSnippet.fetch,
};




/*
const cursor_tracker = (() => {
    let cursor_position = {
        x: undefined,
        y: undefined,
    };

    return {
        mouse_is_hovering_element,
        track,
    };

    function mouse_is_hovering_element(el, {offset={}}={}) {
        const rect = el.getBoundingClientRect();
        for(direction in offset) {
            react[direction] += (['left', 'top'].includes(direction)?-1:1) * offset[direction];
        }
        return (
            rect.top  <= cursor_position.y && cursor_position.y <= rect.bottom &&
            rect.left <= cursor_position.x && cursor_position.x <= rect.right
        );
    }

    function track() {
        if( typeof window === "undefined" ) {
            return;
        }
        window.document.addEventListener('mousemove', onMouseUpdate, {passive: true});
        window.document.addEventListener('mouseenter', onMouseUpdate, {passive: true});
    }

    function onMouseUpdate(e) {
        cursor_position.x = e.pageX;
        cursor_position.y = e.pageY;
        const is_over_logo_section = elements.some(el => mouse_is_hovering_element(el.dom_el));
        update_open_state(is_over_logo_section);
    }
})();
cursor_tracker.track();
*/
