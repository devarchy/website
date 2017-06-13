import React from 'react';
import assert from 'assertion-soft';
import assert_soft from 'assertion-soft';
import classNames from 'classnames';
import timerlog from 'timerlog';
import Scroll from 'react-scroll';

import user_tracker from '../../../user_tracker';

import Thing from '../../../thing/thing';
import Tag from '../../../thing/tag';

import TagPage from '../../pages/tag';
import TagResourcePage from '../../pages/tag-resource';
import LandingPage from '../../pages/landing';

import LogoSnippet from '../../snippets/logo-section';
import LoadingSnippet from '../../snippets/loading';
import ResourceViewSnippet from '../../snippets/resource-view';

import LinkMixin from '../../mixins/link';
import CollapseMixin from '../../mixins/collapse';
import RenderCanceler from '../../mixins/render-canceler';


const Categories = (() => { 
    const CategoryList = ({tag__catalog, tags, selected_tag_id, collapse_depth, onTagClick}) => ( 
        <div>{
            tags.map(tag => {
                assert_soft(tag.is_markdown_category);
                const depth = tag.depth;
                const props = {
                    tag__catalog,
                    tags: tag.child_tags,
                };
                if( depth < collapse_depth ) {
                    Object.assign(props, {
                        selected_tag_id,
                        collapse_depth,
                        onTagClick,
                    });
                }
                let body = (
                    <CategoryList
                      {...props}
                    />
                );

                const is_collapsable = depth === collapse_depth;

                const header = <CategoryHeader {...{tag, is_collapsable, onTagClick, tag__catalog, selected_tag_id}}/>;

                if( is_collapsable ) {
                    body = (
                        <CollapseMixin.component isOpened={selected_tag_id === tag.id}>
                            {body}
                        </CollapseMixin.component>
                    );
                }
                return (
                    <div key={tag.key} style={{paddingLeft: 10}}>
                        {header}
                        {body}
                    </div>
                );
            })
        }</div>
    ); 

    const CategoryHeader = ({tag, is_collapsable, onTagClick, tag__catalog, selected_tag_id}) => { 
        return (
            <div
              onClick={onClick}
              style={{cursor: 'pointer'}}
            >
                {tag.category__title}
            </div>
        );

        function onClick() {
            if( is_collapsable ) {
                onTagClick(tag.id);
            }
            Scroll.scroller.scrollTo(tag.id, get_scroll_opts());
            user_tracker.log_event({
                category: 'Category Link [Tag List]',
                action: tag__catalog.name+' > ... > '+tag.category__title,
                additional_info: {
                    effect: (
                        !is_collapsable && 'scroll' ||
                        (selected_tag_id === tag.id ? 'collapse' : 'expand')
                    ),
                },
            });
        }
    }; 

    let user_scrolled_since_last_click = false;
    if( typeof window !== "undefined" ) {
        window.addEventListener('wheel', () => (user_scrolled_since_last_click = true),{capture: true, passive: true,});
    }
    const Categories = React.createClass({ 
        render: function() {
            const {tag, collapse_depth, style} = this.props;
            assert_soft(tag);
            assert_soft(tag.is_markdown_list);

            const props = {
                tags: tag.child_tags,
                tag__catalog: tag,
                collapse_depth,
                selected_tag_id: this.state.selected_tag_id,
                onTagClick: this.onTagClick,
            };
            return (
                <div style={style}>
                    <CategoryList {...props} />
                </div>
            );
        },
        onTagClick: function(tag_id){
            const selected_tag_id = (() => {
                if( tag_id !== this.state.selected_tag_id ) {
                    return tag_id;
                }
                if( user_scrolled_since_last_click ) {
                    return tag_id;
                }
                return null;
            })();
            user_scrolled_since_last_click = false;
            if( this.state.selected_tag_id === selected_tag_id ) {
                return;
            }
            this.setState({
                selected_tag_id,
            });
        },
        collapse_tags: function(){ this.setState({selected_tag_id: null}) },
        getInitialState: () => ({selected_tag_id: null}),
    }); 

    return Categories;
})(); 

const Lists = React.createClass({ 
    render: function(){
        const props = this.props;
        assert(props && props.tags);
        assert(props.route);
        assert(props.route.params);
        assert(props.route.component);

        return <div>{
                props.tags.map(tag => {
                    const is_selected = props.route.component === TagPage && props.route.params.tag_name === tag.name;
                    return (
                        <div key={tag.key}>
                            <LinkHeader tag={tag} collapse_categories={() => this.refs.tag__childs.collapse_tags()} />
                            <CollapseMixin.component isOpened={is_selected}>
                                <Categories ref="tag__childs"
                                  style={{paddingBottom: 40, marginLeft: 5}}
                                  tag={tag}
                                  collapse_depth={tag.display_options.tag_collapse_depth}
                                />
                            </CollapseMixin.component>
                        </div>
                    );
                })
        }</div>;

        assert(false);

        function LinkHeader(props) {
            assert(props.tag);
            const img_url = props.tag.display_options.tag_logo;
            const tag_name = props.tag.name;
            return (
                <LinkMixin
                  className="css_tag css_heading css_da"
                  to={TagPage.page_route_spec.interpolate_path({tag_name})}
                  dont_track={true}
                  onClick={({preventDefault, same_page}) => {
                      if( same_page ) {
                          preventDefault();
                          props.collapse_categories();
                          Scroll.animateScroll.scrollToTop(get_scroll_opts());
                      }
                      user_tracker.log_event({
                          category: 'Catalog Link [Tag List]',
                          action: tag_name,
                          additional_info: {
                              effect: same_page?'no-op (scroll & collapse)':'change catalog',
                          },
                      });
                  }}
                  style={{width: '100%', marginTop: 0}}
                >
                    { img_url !== null &&
                        <div
                          className='css_tag_icon'
                          style={{backgroundImage: 'url("'+img_url+'")'}}
                        />
                    }
                    {props.tag.display_options.tag_title}
                </LinkMixin>
            );
        }
    },
}); 

let last_tag_list = null;

const TagListSnippet = React.createClass({ 
    propTypes: {
        route: React.PropTypes.object.isRequired,
    },
    render: function() {

        const is_browser = typeof window !== "undefined";

        const tag_list = (() => {

            // don't alter view while loading
            if( is_browser && this.props.is_fetching_data && last_tag_list ) {
                return last_tag_list;
            }

            const list = (
                <Lists
                  tags={this.props.tags}
                  route={this.props.route}
                />
            );

            if( is_browser ) {
                last_tag_list = list;
            }

            return list;
        })();

        return (
              <div
                className={classNames({
                    "css_sidebar_content": true,
                    "css_sidebar_loading": !is_browser || this.props.is_fetching_data,
                })}
              >

                  <LoadingSnippet.component className="css_sidebar_loading_icon" scale={0.8} />

                  <div className="css_tag_list_content">
                      { tag_list }
                  </div>
              </div>
        );

    },
}); 


export default {
    element: props => { 
        const tags = Tag.get_root_lists();


        // we avoid to render somehting empty in order to keep the server side rendered html
        {
            const is_browser = typeof window !== "undefined";
            if( is_browser && props.is_fetching_data && last_tag_list===null ) {
                timerlog({tags: ['client', 'dataflow'], message: 'render tag-list -- canceled'});
                return <RenderCanceler />;
            }
        }
        timerlog({tags: ['client', 'dataflow'], message: 'render tag-list -- pursued'});

        props.tags = tags;
        return (
            <TagListSnippet {...props} />
        );
    }, 
};


function get_scroll_opts() { 
    const scroll_opts = {
        smooth: true,
        duration: 300,
    };

    const container_id = get_scroll_container_id();
    if( container_id ) {
        scroll_opts.containerId = container_id;
    }

    return scroll_opts;

    function get_scroll_container_id() {
        const container = ResourceViewSnippet.get_main_content_scroll_area();
        if( container === document.body ) {
            return null;
        }
        assert_soft(container.id==='sel_scroll_area', container, container.id)
        return container.id;
    }

} 
