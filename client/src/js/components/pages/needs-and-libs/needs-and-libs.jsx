import React from 'react';
import ReactDOM from 'react-dom';
import assert from 'assertion-soft';
import assert_soft from 'assertion-soft';
import classNames from 'classnames';
import route_spec from '../../../util/route_spec';
import text_search from '../../../util/text_search';
import debouncer from '../../../util/debouncer';
import user_tracker from '../../../user_tracker';
import TagPage from '../tag';
import {CatalogLogo, CatalogName} from '../../snippets/catalog-title';
import {CategorySnippet} from '../../snippets/category';
import LoadingSnippet from '../../snippets/loading';
import Progressbar from '../../snippets/progressbar';
import SocialButtonsSnippet from '../../snippets/social-buttons';
import ResourceDetailsSnippet from '../../snippets/resource-details';
import TopicSnippet from '../../snippets/topic';
import {RenderDelayer, scheduler} from '../../mixins/render-delayer';
import LinkMixin from '../../mixins/link';
import CollapsableAdder from '../../mixins/collapsable-adder';
import Thing from '../../../thing';
import Tag from '../../../thing/tag';
import Resource from '../../../thing/resource';
import {IconSearch, IconRemove} from '../../snippets/icon';
//import Scroll from 'react-scroll';


const HeaderContent = (() => {
    class HeaderContent extends React.Component { 
        shouldComponentUpdate(nextProps) {
            return true;
            /*
            if( !assert_soft(nextProps.catalog_data_key) || !assert_soft(this.props.catalog_data_key) ) return;
            if( nextProps.catalog_data_key !== this.props.catalog_data_key ) {
                return true;
            }
            if( nextProps.is_searching !== this.props.is_searching ) {
                return true;
            }
            return false;
            */
        }
        render() {
            const props = this.props;

            const view__title = ( 
                <LinkMixin
                  to={
                    NeedsAndLibsPage__obj.page_route_spec.interpolate_path({
                      tag_name: props.catalog.name,
                      search__value: '',
                      search__type: 'FULL_TEXT_SEARCH',
                    })
                  }
                  track_info={{
                      category: 'click_on_catalog_logo',
                      action: ['page_path'],
                  }}
                >
                    <div className="sel_needs_header_title">
                        <CatalogLogo tag={props.catalog} />
                        <CatalogName tag={props.catalog} />
                    </div>
                </LinkMixin>
            ); 

            return (
                <div className="sel_needs_header">
                    <div className="sel_needs_header_prefix" />
                    { view__title }
                    <CurlyBrace
                      style={{padding: '7px 0px', marginLeft: 5, marginRight: 10}}
                      color="#eaeaea"
                      heightTop={36}
                      width={3}
                    />
                    <div className="sel_needs_header_body">
                        <HeaderTop {...props} />
                        <SearchBox {...props} />
                        <FeedbackView is_searching={this.props.is_searching} />
                    </div>
                </div>
            );
        }
    } 
    HeaderContent.get_props = ({catalog, number_of_included_resources, needs__all}) => {
        return {
            catalog,
            number_of_included_resources,
            needs__all,
        };
    };

    class HeaderTop extends React.Component {
        componentDidMount() {
            if( ! assert_soft(this.dom_el) ) return;
            if( ! this.props.is_searching ) {
                return;
            }
            if( this.dom_el.style.marginTop===0 ) {
                return;
            }
            this.forceUpdate();
        }
        render() {
            const {props} = this;

            const view__counters = (() => { 
                const number_of_needs = props.needs__all.length;
                const number_of_resources = props.number_of_included_resources || 0;
                return (
                    <div
                      style={{
                        fontSize: '2em',
                        textAlign: 'center',
                        marginTop: 7,
                        display: 'inline-block',
                      }}
                    >
                        <code className='css_da css_inline'>{number_of_needs}</code> Needs
                        <span
                           style={{
                             width: 35,
                             display: 'inline-block',
                          }}
                        />
                        <code className='css_da css_inline'>{number_of_resources}</code> Libraries
                    </div>
                );
            })(); 

            const view__social_buttons = ( 
                <SocialButtonsSnippet.component
                  catalog={props.catalog}
                  style={{
                    justifyContent: 'initial',
                    width: 340,
                    marginBottom: 0,
                  }}
                />
            ); 

            const style = {
                marginTop: 0,
            };

            if( this.is_searching__before!==undefined && this.is_searching__before!==props.is_searching ) {
                Object.assign(style, {
                    transition: 'margin-top 0.7s',
                });
            }
            this.is_searching__before = props.is_searching;

            if( props.is_searching ) {
                if( ! this.dom_el || typeof window === "undefined" ) {
                    Object.assign(style, {
                        position: 'absolute',
                        pointerEvents: 'none',
                        // going heavy with hiding because tweet iframe seems to be resilient to hiding
                        visibility: 'hidden',
                        zIndex: -1,
                        opacity: 0,
                        top: -1000,
                    });
                } else {
                    Object.assign(style, {
                        marginTop: "-"+window.getComputedStyle(this.dom_el).getPropertyValue('height'),
                    });
                }
            }

            return (
                <div
                  ref={dom_el => { this.dom_el = dom_el }}
                  style={style}
                >
                    <div>
                        { view__social_buttons }
                    </div>
                    <div>
                        { view__counters }
                    </div>
                </div>
            );
        }
    } 

    const CurlyBrace = props => { 
        // plain HTML & CSS;
        /*
             - https://jsfiddle.net/tn4EX/50/

            ```
            <span class="left-brace-tl top"></span>
            <span class="left-brace-tr top"></span><br />
            <span class="left-brace-bl"></span>
            <span class="left-brace-br"></span>
            span {
                height: 40px;
                width: 10px;
                display: inline-block;
                border-color: grey;
                border-style: solid;
                border-width: 0;
            }
            span.top {
              height: 100px;
            }
            .left-brace-tl {
                border-right-width: 2px;
                border-bottom-right-radius: 10px;
                margin-right:-6px;
                margin-top: 10px;
            }
            .left-brace-tr {
                margin-bottom: 10px;
                border-left-width: 2px;
                border-top-left-radius: 10px;
            }
            .left-brace-bl {
                margin-top: -4px;
                border-right-width: 2px;
                border-top-right-radius: 10px;
                margin-right:-6px;
            }
            .left-brace-br {
                margin-bottom: -8px;
                border-left-width: 2px;
                border-bottom-left-radius: 10px;
            }
            ```
        */

        const height_top = props.heightTop;
        const height_bottom = 'calc(100% - '+height_top+'px - 20px)';
        const width = props.width||2;

        const extremWidth = 1;
        const middleWidth = 2;

        const part = (
            [
                {
                    height: height_top,
                    borderRightWidth: width,
                    borderBottomRightRadius: 10,
                    marginRight: -1*width,
                    marginTop: 10,
                    borderBottomWidth: middleWidth,
                },
                {
                    height: height_top,
                    marginBottom: 10,
                    borderLeftWidth: width,
                    borderTopLeftRadius: 10,
                    borderTopWidth: extremWidth,
                },
                {
                    height: height_bottom,
                    minHeight: height_top,
                    marginTop: -6,
                    borderRightWidth: width,
                    borderTopRightRadius: 10,
                    marginRight: -1*width,
                    borderTopWidth: middleWidth,
                },
                {
                    height: height_bottom,
                    minHeight: height_top,
                    marginBottom: -8,
                    borderLeftWidth: width,
                    borderBottomLeftRadius: 10,
                    borderBottomWidth: extremWidth,
                }
            ]
            .map(style =>
              <span
                style={Object.assign({
                  width: 10,
                  height: 40,
                  display: 'inline-block',
                  borderStyle: 'solid',
                  borderWidth: 0,
                  borderColor: props.color,
                }, style)}
              />
            )
        );

        const div_props = (
            {},
            props,
            {
                style: (
                    Object.assign(
                        props.style||{},
                        {minWidth: 20}
                    )
                ),
            }
        );
        delete div_props.width;
        delete div_props.heightTop;

        return (
            <div {...div_props}>
                {part[0]}
                {part[1]}
                <br/>
                {part[2]}
                {part[3]}
            </div>
        )
    }; 

    const FeedbackView = ({is_searching}) => { 
        if( is_searching ) {
            return null;
        }
        return (
            <div
              style={{
                marginTop: 31,
                marginBottom: -10,
                padding: '10px 14px',
                backgroundColor: '#f9f9f9',
                fontSize: '1.1em',
                borderRadius: 6,
                display: 'inline-block',
              }}
            >
                    Do you like/dislike the new the React catalog version? Let me know at
                    {' '}
                    <LinkMixin
                       url={'https://github.com/devarchy/website/issues/15'}
                       track_info={{
                           category: 'click_on_new_version_feedback_link',
                       }}
                    />
                    .
            </div>
        );
    }; 

    class InputIcon extends React.Component { 
        render() {
            const is_computing = this.props.is_computing;
            const is_searching = this.props.is_searching;
            return (
                <div style={this.props.style}>
                    <div
                      className={classNames("css_input_del", is_searching && !is_computing && "css_input_del__activated")}
                      onClick={ev => {
                          this.props.on_erase();
                      }}
                      onMouseDown={ev => {
                          // prevent input focus loss
                          ev.preventDefault();
                      }}
                    >
                        <IconRemove style={{fontSize: "1.3em", color: "#aaa"}}/>
                    </div>
                    <div
                      className={classNames("css_load_icon", is_computing && "css_load_icon__activated")}
                    >
                        <LoadingSnippet.component size={22} center_loader={true}/>
                    </div>
                </div>
            );
        }
    } 

    const SearchBox = props => { 

        const is_full_text_search = ! ["NEED_SEARCH", 'TOPIC_SEARCH', 'LIBRARY_SEARCH'].includes(props.search__type);
        assert_soft(!is_full_text_search || props.search__type==='FULL_TEXT_SEARCH', props.search__type);

        const overlay = (() => {
            const overlay_content = (() => {
                if( "TOPIC_SEARCH"===props.search__type ) {
                    return (
                        <TopicSnippet
                            catalog_name={props.catalog.name}
                            topic_name={props.search__value}
                        />
                    );
                }
                if( "NEED_SEARCH"===props.search__type ) {
                    return (
                        <div>
                            <span style={{color: '#ccc'}}>
                                {"Need "}
                                <span style={{}}>{">"}</span>
                                {' '}
                            </span>
                            {(props.need_search_target||{}).category__title || props.search__value}
                        </div>
                    );
                }
                if( "LIBRARY_SEARCH"===props.search__type ) {
                    return (
                        <div>
                            <span style={{color: '#ccc'}}>
                                {"Library "}
                                <span style={{}}>{">"}</span>
                                {' '}
                            </span>
                            {(props.resource||{}).resource_name || props.search__value}
                        </div>
                    );
                }
                return null;
            })();

            if( ! overlay_content) {
                return null;
            }

            return (
                <div className="sel_needs_search_box_overlay">{overlay_content}</div>
            );
        })();

        const placeholder = (
            <div className={classNames("sel_input_placeholder", !props.user_input_value && "sel_input_is_empty")} />
        );

        let input_dom_el;
        let hover_induced_focus;

        return (
            <label
              className="css_input_wrapper sel_needs_search_box"
              style={{
                maxWidth: 540,
                height: 42,
                padding: 0,
                width: '100%',
                display: 'flex',
                position: 'relative',
                fontSize: '1.76em',
              }}
            >
                <div
                  className="sel_input_left_area"
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    height: '100%',
                  }}
                  onMouseEnter={() => {
                      if( ! assert_soft(input_dom_el) ) return;
                      if( document.activeElement === input_dom_el ) {
                          return;
                      }
                      input_dom_el.focus();
                      setTimeout(() => input_dom_el.focus(), 1);
                      hover_induced_focus = true;
                  }}
                  onMouseLeave={() => {
                      if( ! assert_soft(input_dom_el) ) return;
                      setTimeout(() => {
                          if( ! input_dom_el ) return;
                          if( hover_induced_focus ) {
                              input_dom_el.blur();
                              hover_induced_focus = false;
                          }
                      }, 100);
                  }}
                  onClick={() => {
                      hover_induced_focus = false;
                  }}
                >
                    <IconSearch
                      style={{
                        height: '1.3em',
                        width: '1.3em',
                        marginTop: 1,
                        marginRight: 10,
                        marginLeft: 8,
                        color: '#aaa',
                      }}
                    />
                    <div
                      className="sel_input_area"
                    >
                        <input
                          onChange={ev => {
                              hover_induced_focus = false;
                              props.on_user_input_change(ev);
                          }}
                          onKeyDown={ev => {
                              hover_induced_focus = false;
                          }}
                          value={props.user_input_value}
                          type="text"
                          autoFocus={is_full_text_search}
                          style={{
                            fontSize: '1em',
                          }}
                          ref={el => input_dom_el = el}
                        />
                        {placeholder}
                        {overlay}
                    </div>
                </div>
                <InputIcon
                  style={{height: '100%'}}
                  is_searching={props.is_searching}
                  on_erase={props.clear_user_input}
                  is_computing={props.is_computing}
                />
            </label>
        );
    }; 

    return HeaderContent;
})();

const BodyContent = (() => {

    const NeedAdder = ({catalog__source_url, catalog__github_full_name}) => { 
        return (
            <CollapsableAdder
                className={"sel_resource_adder"}
                header_text={'Add Need'}
                body_content={
                    <div style={{paddingTop: 3}}>
                        The form to add a Need is work in progress.
                        <br/>
                        { catalog__source_url &&
                            <span>
                                Make a PR at
                                {' '}
                                <LinkMixin
                                    url={catalog__source_url}
                                    track_info={{
                                        category: 'action_in_need_adder',
                                    }}
                                />
                                {' '}
                                in the meantime.
                            </span>
                        }
                    </div>
                }
            />
        );
    }; 

    class LibraryList extends React.Component { 
        shouldComponentUpdate(nextProps) {
            const should_update = Body__should_update(nextProps, this.props, {not_computing_sensitive: true});
            return should_update;
        }
        render () {
            const {full_text_search_value, topic_search_value, need_search_target, categories__data, needs__filtered, has_rendered_before} = this.props;
            return (
                <div>{
                    needs__filtered
                    .filter(({need__hidden}) => need__hidden!==true)
                    .map(({need__id, need__hidden, need__missing_words}) => {
                        const category__data = categories__data[need__id];
                        const key = category__data.key;
                        assert_soft(key);
                        const is_need_search_target = need_search_target.id===need__id;
                        assert_soft(!is_need_search_target || !need__hidden);
                        return (
                            <div
                              style={{display: need__hidden && 'none'}}
                              key={key}
                            >
                                <CategorySnippet
                                  full_text_search_value={full_text_search_value}
                                  topic_search_value={topic_search_value}
                                  is_need_search_target={is_need_search_target}
                                  need__missing_words={need__missing_words}
                                  { ...category__data }
                                  dont_rerender={need__hidden}
                                  has_rendered_before={has_rendered_before}
                                />
                            </div>
                        );
                    })
                }</div>
            );
        }
    } 
    LibraryList.get_props = ({catalog, needs__all, categories_resources, catalog_data_key}) => { 
        assert(catalog);
        assert(catalog.constructor === Tag);
        assert(catalog.is_markdown_list);
        assert_soft(catalog_data_key);

        const categories__data = {};
        needs__all
        .forEach(tag_category => {
            categories__data[tag_category.id] = (
                CategorySnippet.get_props({
                    tag: catalog,
                    tag_category,
                    is_need_view: true,
                    categories_resources,
                })
            );
        });

        return {
            catalog_data_key,
            categories__data,
        };
    }; 

    class BodyContent extends React.Component {
        shouldComponentUpdate(nextProps) {
            const should_update = Body__should_update(nextProps, this.props);
         // if( should_update ) { console.log('render body'); }
            return should_update;
        }
        render() {
            return BodyContent__render(this.props);
        }
        componentDidMount() {
            this.props.updateWhenRenderDelayDone();
        }
        componentDidUpdate() {
            this.props.updateWhenRenderDelayDone();
        }
    }
    function Body__should_update(nextProps, props, {not_computing_sensitive}={}) { 
        if( !assert_soft(nextProps.catalog_data_key) || !assert_soft(props.catalog_data_key) ) return true;
        if( nextProps.catalog_data_key !== props.catalog_data_key ) {
            return true;
        }
        if( !assert_soft(nextProps.search__type) || !assert_soft(props.search__type) ) return true;
        if( nextProps.search__type !== props.search__type ) {
            return true;
        }
        if( nextProps.search__value !== props.search__value ) {
            return true;
        }
        if( ! not_computing_sensitive ) {
            assert_soft([nextProps, props].every(p => [true,false].includes(p.is_computing)), nextProps, props);
            if( nextProps.is_computing !== props.is_computing ) {
                return true;
            }
        }
        return false;
    } 
    function BodyContent__render(props) { 
        assert(props.catalog, props);

        const {needs__filtered, topic_list__filtered, all_needs_hiding, number_of_needs_shown} = props.search_result_all;

        const {search__type, search__value} = props;
        const {is_searching} = props;
        const {topic_search_value, need_search_target} = props;

        const full_text_search_value = (search__type==='FULL_TEXT_SEARCH' && is_searching) ? search__value : null;
        assert_soft([true, false].includes(is_searching));

        const section_title_prefix = is_searching?'Matched':'All';

        const view__topics = (() => { 

            if( topic_list__filtered===null ) {
                return null;
            }

            const topics_to_show = topic_list__filtered===undefined ? props.topic_list__all : topic_list__filtered;

            return (
                <div
                  style={{
                    marginBottom: 20,
                    display: all_needs_hiding && 'none',
                  }}
                >
                    <h4 className="sel_section_title">{section_title_prefix} Topics</h4>
                        {
                            topics_to_show.length === 0 ? (
                                '\u2205'
                            ) : (
                                <div className="sel_block_list" style={{marginTop: 8}}>{
                                    topics_to_show
                                    .map(topic_name =>
                                        <TopicSnippet
                                            key={topic_name}
                                            catalog_name={props.catalog.name}
                                            topic_name={topic_name}
                                            full_text_search_value={full_text_search_value}
                                        />
                                    )
                                }</div>
                            )
                        }
                </div>
            );
        })(); 

        const view__needs = (() => { 
            if( number_of_needs_shown<=1 ) {
                return null;
            }
            if( props.library_search_target ) {
                return null;
            }
            return (
                <div
                  style={{
                    marginBottom: 20,
                    display: all_needs_hiding && 'none',
                  }}
                >
                    <h4 className="sel_section_title">{section_title_prefix} Needs</h4>
                    <div className="sel_block_list">
                        {
                            needs__filtered.map(({need__permalink, need__title, need__id, need__name, need__hidden, need__missing_words}) => {
                                return (
                                    <LinkMixin
                                      to={need__permalink}
                                      key={need__id}
                                      style={{
                                          display: need__hidden && 'none',
                                          opacity: is_searching && need__missing_words.length>0 && 0.5,
                                      }}
                                      track_info={{
                                          category: 'click_on_need_in_overview',
                                          action: need__name,
                                      }}
                                    >
                                        { text_search.highlight_search_match(need__title, full_text_search_value) }
                                    </LinkMixin>
                                );
                            })
                        }
                    </div>
                    <NeedAdder catalog__github_full_name={props.catalog__github_full_name} catalog__source_url={props.catalog__source_url} />
                </div>
            );
        })(); 

        const view__libraries = ( 
            props.library_search_target ? (
                null
            ) : (
                <div
                  style={{
                    position: 'relative',
                    display: all_needs_hiding && 'none',
                  }}
                  className={props.is_computing && "sel_is_computing"}
                >
                    <LibraryList
                      { ...props.data__library_list }
                      needs__filtered={needs__filtered}
                      full_text_search_value={full_text_search_value}
                      topic_search_value={topic_search_value}
                      need_search_target={need_search_target}
                      search__type={props.search__type}
                      search__value={props.search__value}
                      has_rendered_before={props.has_rendered_before}
                    />
                </div>
            )
        ); 

        const view__resource = (() => { 
            if( ! props.library_search_target ) {
                return null;
            }
            if( ! assert_soft(props.catalog) ) return;
            if( ! assert_soft(props.library_search_target) ) return;

            return (
                <ResourceDetailsSnippet.component
                  tag={props.catalog}
                  resource={props.library_search_target}
                />
            );
        })(); 

        const view__nothing_found = ( 
            props.library_search_target ? (
                null
            ) : (
                <div
                  style={{display: !all_needs_hiding && 'none'}}
                >
                    <div style={{fontSize: '2.7em', textAlign: 'center', color: '#888', marginBottom: 4}}>{'\u2205'}</div>
                    <div style={{width: '100%', textAlign: 'center', fontSize: '1.1em', color: '#888'}}>
                        {'No'}
                        {search__type==='NEED_SEARCH' && ' Need' || search__type==='TOPIC_SEARCH' && ' topic' || search__type==='LIBRARY_SEARCH' && ' library' || 'thing'}
                        {' found matching '}
                        <i style={{color: '#555'}}>{search__value}</i>
                    </div>
                </div>
            )
        ); 

        return (
            <div className={"sel_needs_body"}>
                { view__nothing_found }
                { view__topics }
                { view__needs }
                { view__resource }
                { view__libraries }
            </div>
        );
    }; 
    BodyContent.get_props = ({catalog, categories_resources, needs__all, catalog_data_key}) => { 
        const topic_list__all = catalog.get_topic_list();

        return {
            catalog__source_url: catalog.catalog__source_url,
            catalog__github_full_name: catalog.catalog__github_full_name,
            catalog,
            topic_list__all,
            needs__all,
            catalog_data_key,
            data__library_list: (
                LibraryList.get_props({
                    catalog,
                    catalog_data_key,
                    needs__all,
                    categories_resources,
                })
            ),
        };
    }; 

    return BodyContent;
})();


let has_rendered_before = false;
class NeedsAndLibsPage extends React.Component {
    componentDidMount() {
        scheduler.batchSize = 30;

        NeedsAndLibsPage__obj.route_change_handler = ({pathname, params}) => {
            const {tag_name, route_search_query} = page_route_spec.get_route_params({pathname});
            assert_soft(params.route_search_query===route_search_query, params, route_search_query);

            if( this.props.catalog.name !== tag_name ) {
                return false;
            }

            /*
            {
                const {search__type} = parse_query_string({search_query: this.state.search_query});
                if( search__type === 'LIBRARY_SEARCH' ) {
                    return false;
                }
            }
            */
            {
                const {search__type} = parse_query_string({search_query: (route_search_query||'')});
                if( search__type === 'LIBRARY_SEARCH' ) {
                    return false;
                }
            }

            if( ! this.is_debouncing ) { // we need to catch whether the route has been updated because of a user input value change
                this.change_search({sq: route_search_query||'', path_already_updated: true, show_progress_bar: true});
            }

            return true;
        };
    }
    componentWillUnmount() {
        NeedsAndLibsPage__obj.route_change_handler = null;
    }
    constructor(props) {
        super();

        const search_query = props.search_query__initial;
        assert_soft(search_query.constructor===String, props);

        const {search__type, search__value} = parse_query_string({search_query});

        this.is_debouncing = false;

        this.compute_search_result(search_query, props);

        this.state = {
            search_query,
            is_delaying_render: true,
            user_input_value: this.get_user_input_value(search_query),
        };

        {
            const debounced_state_change = (
                debouncer(search_query => {
                    this.is_debouncing = false;
                    this.compute_search_result(search_query);
                    this.setState(
                        {
                            is_delaying_render: true,
                            search_query,
                        },
                        this.scrollUp.bind(this),
                    );
                }, {time: 300})
            );
            this.set_search_query__debounced = search_query => {
                this.is_debouncing = true;
                debounced_state_change(search_query)
            }
        }
    }
    scrollUp() {
        if( ! assert_soft(typeof window !== "undefined") ) return;
     // Scroll.animateScroll.scrollToTop();
        window.scrollTo(0);

    }
    compute_search_result(search_query, props) {
        props = props || this.props;
        this.search_result_all = (
            compute_search({
                search_query,
                catalog: props.catalog,
                needs__all: props.needs__all,
                categories_resources: props.categories_resources,
            })
        );
    }
    get_user_input_value(search_query) {
        const {search__type, search__value} = parse_query_string({search_query});

        return (
            ['NEED_SEARCH', 'TOPIC_SEARCH', 'LIBRARY_SEARCH'].includes(search__type) ? '' : search__value
        );
    }
    change_search({sq, debounce_change, path_already_updated, show_progress_bar, track_it}) {

        if( show_progress_bar ) {
            Progressbar.start();
        }

        assert_soft(sq.constructor===String);

        const search_query = sq;

        const state__new = {
            user_input_value: this.get_user_input_value(search_query),
        };

        if( ! debounce_change ) {
            this.compute_search_result(search_query);
            Object.assign(state__new, {
                search_query,
                is_delaying_render: true,
            });
        }

        this.setState(
            state__new,
            () => {
                if( ! debounce_change ) {
                    this.scrollUp();
                }
            }
        );

        if( debounce_change ) {
            this.set_search_query__debounced(search_query);
        }

        if( track_it ) {
            user_tracker.trackers.track_search(search_query);
        }

        if( ! path_already_updated ) {
            update_url_path({search_query, catalog_name: this.props.catalog_name});
        }

        update_title({tag_name: this.props.catalog_name, route_search_query: search_query});

        if( show_progress_bar ) {
            Progressbar.done();
        }
    }
    on_user_input_change(ev) {
        let sq = ev.target.value;
        /*
        // TODO; properly fix this
        if( sq && sq.constructor===String ) {
            sq = sq.split('/').join(encodeURIComponent('/'))
        }
        */
        this.change_search({sq, debounce_change: true, track_it: true});
    }
    clear_user_input(cb) {
        this.change_search({sq: '', show_progress_bar: true});
    }
    updateWhenRenderDelayDone() {
        if( ! this.is_awaiting_render_delays ) {
            this.is_awaiting_render_delays = true;
            RenderDelayer.callWhenIdle(() => {
                if( this.state.is_delaying_render ) {
                    this.setState(
                        {
                            is_delaying_render: false
                        },
                        () => {
                            this.is_awaiting_render_delays = false;
                        }
                    );
                } else {
                    this.is_awaiting_render_delays = false;
                }
            });
        }
    }
    render() {
        const search_query = this.state.search_query;

        const is_searching = !!search_query;

        const {search__type, search__value} = parse_query_string({search_query});

        const library_search_target = search__type === 'LIBRARY_SEARCH' && Resource.get_resource_by_name({tag_name: this.props.catalog.name, resource_human_id: search__value}).resource;

        const on_user_input_change = this.on_user_input_change.bind(this);
        const clear_user_input = this.clear_user_input.bind(this);
        const user_input_value = this.state.user_input_value;

        const search_result_all = this.search_result_all;
        assert_soft(search_result_all);

        const topic_search_value = search__type==='TOPIC_SEARCH' && search__value;
        const need_search_target = search__type==='NEED_SEARCH' && search_result_all.needs__filtered.filter(({need__hidden}) => need__hidden===false).map(({need}) => need)[0];

        const is_computing = (
            this.is_debouncing ||
            this.state.is_delaying_render
        );

        const updateWhenRenderDelayDone = this.updateWhenRenderDelayDone.bind(this);

        const el = (
            <div>
                <HeaderContent
                  {...this.props.data__header_content}
                  {...{
                      is_searching,
                      is_computing,
                      on_user_input_change,
                      user_input_value,
                      clear_user_input,
                      search__type,
                      search__value,
                      topic_search_value,
                      need_search_target,
                  }}
                />
                <RenderDelayer dontDelayRender={has_rendered_before===false}>
                    <BodyContent
                      {...this.props.data__body_content}
                      {...{
                        search_result_all,
                        is_computing,
                        is_searching,
                        search__type,
                        search__value,
                        topic_search_value,
                        need_search_target,
                        library_search_target,
                        updateWhenRenderDelayDone,
                        has_rendered_before,
                      }}
                    />
                </RenderDelayer>
            </div>
        );
        has_rendered_before = true;
        return el;
    }
};
NeedsAndLibsPage.get_props = ({tag, route_search_query}) => {
    const catalog = tag;

    const {categories_resources, number_of_included_resources} = catalog.get_all_info();

    const needs__all = catalog.get_needs_list();

    const catalog_data_key = Math.random();

    return {
        search_query__initial: route_search_query||'',
        catalog,
        catalog_name: catalog.name,
        needs__all,
        categories_resources,
        data__header_content: HeaderContent.get_props({catalog, number_of_included_resources, needs__all}),
        data__body_content: BodyContent.get_props({catalog, categories_resources, needs__all, catalog_data_key}),
    };
};

function compute_search({search_query, needs__all, categories_resources, catalog}) { 

    assert_soft(categories_resources);
    assert_soft(catalog);

    const {search_is_activated, search__type, search__value} = parse_query_string({search_query});
    assert_soft(SEARCH_TYPES[search__type]);

    const {needs__filtered, all_needs_hiding, number_of_needs_shown} = (() => {

        const inspector = (() => {
            if( search__type==='NEED_SEARCH' && search__value ) {
                const need_found = Tag.find_need_by_human_id({catalog, human_id: search__value});
                return need => ({
                    need__hidden: !need_found || need.id!==need_found.id,
                    need__missing_words: [],
                    need__sort_key: null,
                });
            }
            if( search__type==='TOPIC_SEARCH' && search__value ) {
                const needs__matched = Tag.find_by_topic({catalog, topic_name: search__value});
                return need => ({
                    need__hidden: !needs__matched[need.id],
                    need__missing_words: [],
                    need__sort_key: null,
                });
            }
            if( search__type==='LIBRARY_SEARCH' ) {
                return need => ({
                    need__hidden: true,
                    need__missing_words: [],
                    need__sort_key: null,
                });
            }
            const full_text_search_value = search__value;
            assert_soft(search__type==='FULL_TEXT_SEARCH' && full_text_search_value===search_query);
            return need => need.get_search_result({full_text_search_value, categories_resources});
        })();

        const {needs__filtered, number_of_needs_shown} = (() => {
            let number_of_needs_shown = 0;
            return {
                needs__filtered: (
                    needs__all
                    .map(need => ({
                        need,
                        need__id: need.id,
                        need__name: need.name,
                        need__title: need.category__title,
                        need__permalink: need.category__permalink,
                    }))
                    .map(need__info => {
                        if( ! search_is_activated ) {
                            return need__info;
                        }
                        const {need, need__id, need__name, need__title, need__permalink} = need__info;

                        assert(need && need.is_category, need);

                        const {need__missing_words, need__sort_key, need__hidden} = inspector(need);

                        if( ! need__hidden ) {
                            number_of_needs_shown++;
                        }

                        return ({
                            need,
                            need__id,
                            need__name,
                            need__title,
                            need__permalink,
                            need__missing_words,
                            need__sort_key,
                            need__hidden,
                        });
                    })
                ),
                number_of_needs_shown: (
                    ! search_is_activated ? (
                        needs__all.length
                    ) : (
                        number_of_needs_shown
                    )
                ),
            };
        })();

        const all_needs_hiding = search_is_activated && number_of_needs_shown===0;

        assert_soft(search__type!=='NEED_SEARCH' || number_of_needs_shown<=1, search_query, search__value, number_of_needs_shown);
        if( search_is_activated && number_of_needs_shown>1 && search__type!=='TOPIC_SEARCH' ) {
            needs__filtered
            .sort(({need__sort_key: s1}, {need__sort_key: s2}) => {
                assert_soft(s1.length>0, s1);
                assert_soft(s2.length>0, s2);
                for(var i in s1) {
                    if( s1[i] !== s2[i] ) {
                        return s2[i] - s1[i];
                    }
                }
                return 0;
            })
        }

        assert_soft(number_of_needs_shown>=0, number_of_needs_shown);

        return {needs__filtered, all_needs_hiding, number_of_needs_shown};
    })();

    const topic_list__filtered = (() => {
        if( search__type!=='FULL_TEXT_SEARCH' ) {
            return null;
        }
        if( ! search_is_activated ) {
            return undefined;
        }

        const topics = new Set();
        needs__filtered
        .forEach(({need__hidden, need}) => {
            if( need__hidden ) {
                return;
            }
            need.category__topics.forEach(topic_name => topics.add(topic_name));
        });

        return (
            Array.from(topics)
            .sort((t1, t2) => (
                (-1*text_search.get_missing_words({full_text_search_value: search__value, texts: [t2], per_text: false}).length) -
                (-1*text_search.get_missing_words({full_text_search_value: search__value, texts: [t1], per_text: false}).length)
            ))
        )
    })();

    return {all_needs_hiding, needs__filtered, topic_list__filtered, number_of_needs_shown};
} 

const SEARCH_TYPES = {
    'NEED_SEARCH': {
        search_query_prefix: 'need/',
    },
    'TOPIC_SEARCH': {
        search_query_prefix: 'topic/',
    },
    'LIBRARY_SEARCH': {
        search_query_prefix: 'library/',
    },
    'FULL_TEXT_SEARCH': {
        search_query_prefix: '',
    },
};

function parse_query_string({search_query}) { 
    if( ! assert_soft(search_query==='' || search_query && search_query.constructor===String, search_query) ) search_query='';

    for(var [search__type, {search_query_prefix}] of Object.entries(SEARCH_TYPES)) {
        if( search_query.startsWith(search_query_prefix) ) {
            const search__value = search_query.slice(search_query_prefix.length);
            if( search__value ) {
                return ({
                    search__type,
                    search__value,
                    search__query: search_query,
                    search_is_activated: true,
                });
            }
        }
    }

    return ({
        search__type: 'FULL_TEXT_SEARCH',
        search__value: search_query,
        search__query: search_query,
        search_is_activated: !!search_query,
    });
} 

const page_route_spec = (() => { 

    const ROUTES = Object.entries({
        '/react': 'react',
    });

    return (
        route_spec({
            path_is_matching: ({pathname}) => !!get_route_info(pathname),
            interpolate_path,
            get_route_pattern: () => '(needs_and_libs_manual_route)',
            get_route_params: ({pathname}) => get_route_info(pathname),
        })
    );

    function interpolate_path({tag_name, search__value, search__type}) {
        assert_soft(tag_name);
        assert_soft(search__type && SEARCH_TYPES[search__type], search__type);
        assert_soft(search__value==='' || search__value && search__value.constructor===String, search__value);

        for(const [source, target] of ROUTES) {
            if( target===tag_name ) {
                return (
                    [
                        source,
                        [
                            (SEARCH_TYPES[search__type]||{}).search_query_prefix || '',
                            encodeURIComponent(search__value),
                        ].join('')
                    ]
                    .filter(Boolean)
                    .join('/')
                );
            }
        }
        assert_soft(false, tag_name, search__value, search__type);
        return null;
    }

    function get_route_info(pathname) {
        if( ! assert_soft(pathname && pathname.constructor===String && pathname[0]==='/', pathname) ) return null;

        for(const [source, target] of ROUTES) {
            if( pathname.startsWith(source) ) {
                const tag_name = target;
                const path_rest = pathname.slice(source.length);
                let route_search_query = null;
                if( path_rest ) {
                    if( path_rest[0]!=='/' || !path_rest[1] ) {
                        continue;
                    }
                    route_search_query = decodeURIComponent(path_rest.slice(1));
                }
                return {tag_name, route_search_query};
            }
        }

        return null;
    }
})(); 

function update_title({tag_name, route_search_query}) { 
    if( ! assert_soft(typeof window !== "undefined") ) return;
    if( ! assert_soft(tag_name) ) return;
    const page_head = (
        NeedsAndLibsPage__obj.get_page_head({
            route: {params: {
                tag_name,
                route_search_query,
            }},
            is_fetching_data: false}
        )
    );
    if(
        assert_soft(page_head && page_head.title, page_head, route_search_query, tag_name)
    ) {
        window.document.title = page_head.title;
    }
} 

const update_url_path = (() => { 
    if( typeof window === "undefined" ) {
        return () => {assert_soft(false)};
    }
    const navigation = require('../../../navigation').default;
    let path_recently_updated = false;
    const check_update_time = debouncer(() => {
        path_recently_updated = false;
    }, {time: 2000});
    return (
        ({search_query, catalog_name}) => {
            const {search__type, search__value} = parse_query_string({search_query});
            const pathname_new = (
                page_route_spec.interpolate_path({
                    tag_name: catalog_name,
                    search__value,
                    search__type,
                })
            );
            const updater = (
                path_recently_updated ? (
                    navigation.update_location.bind(navigation)
                ) : (
                    navigation.navigate_to.bind(navigation)
                )
            );
            path_recently_updated = true;
            updater(pathname_new);
            check_update_time();
        }
    );
})(); 

const NeedsAndLibsPage__obj = {
    page_route_spec,
    fetch: (...args) => { 
        const {search__type, search__value} = parse_query_string({search_query: args[0].route.params.route_search_query||''});

        if( search__type === 'LIBRARY_SEARCH' ) {
            const tag_name = args[0].route.params.tag_name;
            const resource_human_id = search__value;
            assert_soft(tag_name);
            assert_soft(resource_human_id);
            return (
                Tag.retrieve_categories_and_resources(tag_name)
                .then(() => {
                    const {resource} = Resource.get_resource_by_name({tag_name, resource_human_id});
                    if( ! resource ) {
                        return;
                    }
                    return ResourceDetailsSnippet.fetch({resource_id: resource.id});
                })
            );
        }

        return (
            TagPage.fetch.apply(TagPage, args)
        );
    }, 
    element: args => TagPage.element(Object.assign({}, args, {component_to_return: NeedsAndLibsPage})),
    component: NeedsAndLibsPage,
    hide_sidebar: true,
    get_page_head: function({route: {params: {tag_name, route_search_query}}, is_fetching_data}) { 
        const catalog = Tag.get_by_name(tag_name, {can_be_null: true});

        const {search__type, search__value} = parse_query_string({search_query: route_search_query||''});

        if( !search__value || !catalog ) {
            return TagPage.get_page_head.apply(TagPage, arguments);
        }

        const display_options = catalog.display_options;
        const {tag_title, tag_description} = display_options;

        if( search__type === 'NEED_SEARCH' ) {
            const need = Tag.find_need_by_human_id({catalog, human_id: search__value});

            if( ! need ) {
                return {
                    title: (
                        [
                            tag_title,
                            search__value,
                        ]
                        .join(' - ')
                    ),
                    description: (
                        [
                            tag_description,
                            search__value,
                        ].join(' - ')
                    ),
                    hide_sidebar: true,
                };
            }

            const desc = (need.category__desc||'').replace(/\.+$/, '');

            return {
                title: (
                    [
                        tag_title,
                        need.category__title,
                        desc,
                    ]
                    .filter(Boolean)
                    .join(' - ')
                ),
                description: (
                    [
                        tag_description,
                        need.category__title,
                        desc,
                        need.category__elaboration,
                    ]
                    .filter(Boolean)
                    .join(' - ')
                ),
                hide_sidebar: true,
            };
        }

        if( search__type === 'TOPIC_SEARCH' ) {
            return {
                title: (
                    [
                        tag_title,
                        search__value+' related libraries',
                    ].join(' - ')
                ),
                description: (
                    [
                        tag_description,
                        search__value+' related libraries',
                    ].join(' - ')
                ),
                hide_sidebar: true,
            };
        }

        if( search__type === 'FULL_TEXT_SEARCH' ) {
            let title, description;
            title = description = (
                [
                    tag_description,
                    search__value,
                ].join(' - ')
            );
            return {
                title,
                description,
                hide_sidebar: true,
            };
        }

        if( search__type === 'LIBRARY_SEARCH' ) {
        const {resource} = Resource.get_resource_by_name({tag_name: catalog.name, resource_human_id: search__value});
            return {
                title: (
                    [
                        tag_title,
                        resource && resource.resource_name,
                    ].filter(Boolean).join(' - ')
                ),
                description: (
                    [
                        tag_description,
                        resource && resource.resource_name,
                        resource && resource.resource_desc,
                    ].filter(Boolean).join(' - ')
                ),
                hide_sidebar: true,
            };
        }

        assert_soft(false);
    }, 
    route_change_handler: null,
};

export default NeedsAndLibsPage__obj;
