import React from 'react';
import assert from 'assert';
import classNames from 'classnames';

import Thing from '../../thing/thing';
import Tag from '../../thing/tag';

import TagPage from '../pages/tag';
import LoadingSnippet from '../snippets/loading';
import LinkMixin from '../mixins/link';
import CollapseMixin from '../mixins/collapse';
import Scroll from 'react-scroll';


const SCROLL_CONTAINER_ID = "js_content";

const ScrollTagList = (() => {
    let user_scrolled_since_last_click = false;
    if( typeof window !== "undefined" ) {
        window.document.getElementById(SCROLL_CONTAINER_ID).addEventListener('wheel', () => (user_scrolled_since_last_click = true),{capture: true, passive: true,});
    }

    return React.createClass({ 
        expand_tag: function(tag_id){
            const expanded_tag_id = (() => {
                if( tag_id !== this.state.expanded_tag_id ) {
                    return tag_id;
                }
                if( user_scrolled_since_last_click ) {
                    return tag_id;
                }
                if( this.child_tag_clicked ) {
                    return tag_id;
                }
                return null;
            })();
            user_scrolled_since_last_click = false;
            this.child_tag_clicked = false;
            if( this.state.expanded_tag_id === expanded_tag_id ) {
                return;
            }
            this.setState({
                expanded_tag_id,
            });
        },
        handle_child_tag_click: function(){ this.child_tag_clicked = true },
        collapse_tags: function(){ this.setState({expanded_tag_id: null}) },
        getInitialState: () => ({expanded_tag_id: null}),
        render: function() {
            assert(this.props.tags);
            return (
                <div
                  style={Object.assign({paddingLeft: 15, fontSize: '.95em'}, this.props.style)}
                >{
                    this.props.tags.map(tag => {
                        const scroll_body = (() => {
                            const children = <ScrollTagList onClick={on_child_tags_click.bind(this)} tags={tag.child_tags} />;
                            if( tag.depth>1 ) {
                                return children;
                            }
                            const is_selected = this.state.expanded_tag_id === tag.id;
                            return (
                                <CollapseMixin.component isOpened={is_selected}>
                                    {children}
                                </CollapseMixin.component>
                            );
                        })();
                        return <div key={tag.key}>
                            <ScrollHeader tag={tag} onClick={on_header_click.bind(this, tag.id)} />
                            {scroll_body}
                        </div>;
                    })
                }</div>
            );

            function on_child_tags_click() {
                if( this.props.onClick ) {
                    this.props.onClick();
                }
                this.handle_child_tag_click();
            }

            function on_header_click(tag_id) {
                if( this.props.onClick ) {
                    this.props.onClick();
                }
                this.expand_tag(tag_id);
            }

            function ScrollHeader(props) {
                return (
                    <Scroll.Link
                        to={props.tag.id}
                        containerId={SCROLL_CONTAINER_ID}
                        smooth={true}
                        duration={300}
                        spy={false}
                        activeClass="active"
                        onClick={props.onClick}
                        style={{cursor: 'pointer'}}
                    >
                        {props.tag.display_title}
                    </Scroll.Link>
                );
            }
        },
    }); 
})();

const RootTagList = React.createClass({ 
    render: function(){
        const props = this.props;
        assert(props && props.tags);
        assert(props.tags.every(tag => !tag.parent_tag));
        assert(props.route);
        assert(props.route.params);
        assert(props.route.component);

        return <div>{
                props.tags.map(tag => {
                    const is_selected = props.route.component === TagPage && props.route.params.tag_name === tag.name;
                    return <div key={tag.key}>
                        <LinkHeader tag={tag} on_intercepted={() => this.refs.tag__childs.collapse_tags()} />
                        {
                            <CollapseMixin.component isOpened={is_selected}>
                                <ScrollTagList ref="tag__childs" style={{paddingBottom: 40}} tags={tag.child_tags} />
                            </CollapseMixin.component>
                        }
                    </div>;
                })
        }</div>;

        assert(false);

        function LinkHeader(props) {
            assert(props.tag);
            return (
                <LinkMixin.component
                  className={'css_tag'}
                  to={TagPage.route.interpolate({tag_name: props.tag.name})}
                  interceptor={same_page => { if( same_page ) {
                      Scroll.animateScroll.scrollToTop({containerId: SCROLL_CONTAINER_ID, duration: 300, smooth: true});
                      props.on_intercepted();
                      return true;
                  }}}
                  style={{width: '100%', marginTop: 0}}
                >
                    <div className='css_tag_icon'>
                        <svg width="20" height="20" viewBox="6 -2 23 19">
                            <title>Awesome list logo created by Sindre Sorhus</title>
                            <path fill="currentColor" d="M26.57 9.34l-4.91-4.5-.69.75 4.09 3.75H8.94l4.09-3.75-.69-.75-4.91 4.5v2.97c0 1.34 1.29 2.43 2.88 2.43h3.03c1.59 0 2.88-1.09 2.88-2.43v-1.95h1.57v1.95c0 1.34 1.29 2.43 2.88 2.43h3.03c1.59 0 2.88-1.09 2.88-2.43l-.01-2.97z"/>
                        </svg>
                    </div>
                    {props.tag.display_title__strip_awesome}
                </LinkMixin.component>
            );
        }
    },
}); 


const TagListSnippet = (() => { 

    let last_tag_list = null;

    return React.createClass({
        propTypes: {
            route: React.PropTypes.object.isRequired,
        },
        render: function() {

            const is_fetching = taglist_is_fetching || TagPage.is_fetching;

            if( TagPage.is_fetching ) {
                TagPage.fetch_promise.then(() => {
                    if( !this.isMounted() ) {
                        return;
                    }
                    this.forceUpdate();
                });
            }

            // don't alter view while loading
            const tag_list = last_tag_list = is_fetching && last_tag_list ||
                <RootTagList
                  tags={Tag.list_things({only_root: true}).reverse()}
                  route={this.props.route}
                />;

            return (
                <div
                  className={classNames({
                      'css_loading_block': true,
                      'css_loading_block__loading': is_fetching,
                  })}
                >{
                    tag_list
                }</div>
            );

        },
    });
})(); 

let taglist_is_fetching = false;


export default {
    component: TagListSnippet,
    fetch: () => {
        taglist_is_fetching = true;
        return (
            Tag.retrieve_things()
        ).then(() => {
            taglist_is_fetching = false;
        });
    },
};
