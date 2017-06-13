import React from 'react';
import assert from 'assertion-soft';
import assert_soft from 'assertion-soft';
import classNames from 'classnames';

import Thing from '../../../thing';
import Resource from '../../../thing/resource';
import Tag from '../../../thing/tag';

import Scroll from 'react-scroll';

import user_tracker from '../../../user_tracker';
import text_search from '../../../util/text_search';

import PopularBoardSnippet from '../../snippets/popular-board';
import ResourcesGraveyardCribSnippet from '../../snippets/resources-graveyard-crib';
import AddResourceSnippet from '../../snippets/add-resource';
import CollapsableAdder from '../../mixins/collapsable-adder';
import {RenderDelayer} from '../../mixins/render-delayer';
import LinkMixin from '../../mixins/link';
import ButtonSnippet from '../../snippets/button';
import TopicSnippet from '../../snippets/topic';


const LibraryAdder = ({markdown_list__name, tag_category_id, category__title, is_need_view}) => {
    assert_soft(markdown_list__name);
    assert_soft(tag_category_id);
    assert_soft(category__title);

    return (
        <CollapsableAdder
            className={"sel_resource_adder"}
            header_text={'Add library'}
            body_content={
                <AddResourceSnippet.component
                  tag__markdown_list__name={markdown_list__name}
                  tag_category_id={tag_category_id}
                  is_need_view={is_need_view}
                />
            }
            disable_tracking={true}
            on_toggle={expanded => {
                user_tracker.log_event({
                    category: (expanded?'extend':'collapse')+' add_entry',
                    action: markdown_list__name+' > ... > '+category__title,
                })
            }}
        />
    );
};

const CatalogAdder = () => {
    return (
        <CollapsableAdder
            className={"sel_resource_adder"}
            header_text={'Add catalog'}
            style={{paddingTop: 3}}
            body_content={
                <div style={{paddingTop: 10}}>
                    Contact Romuald to add a catalog to devarchy.
                    <br/>
                    Romuald's contact informations are over
                    {' '}
                    <LinkMixin
                      url="http://brillout.com"
                      text="there"
                      track_info={{
                        category: 'action_in_catalog_adder',
                      }}
                    />
                    .
                </div>
            }
        />
    );
};

class CategorySnippet extends React.Component { 
    shouldComponentUpdate(nextProps) {
        if( nextProps.dont_rerender ) {
            return false;
        }
        return true;
    }
    render () {
        const section__breadcrumb = (() => {
            if( ! this.props.category__breadcrumb ) {
                return null;
            }
            return (
                <div className='css_header_breadcrumb'>
                    {this.props.category__breadcrumb}
                </div>
            );
        })();

        const section__header = (() => {
            const title = (() => {
                if( this.props.is_need_search_target ) {
                    return text_search.hightlight_text(this.props.category__title);
                }
                if( this.props.full_text_search_value ) {
                    return (
                        text_search.highlight_search_match(this.props.category__title, this.props.full_text_search_value)
                    );
                }
                return this.props.category__title;
            })();

            let header = (
                this.props.depth === 1 && <h2 className="css_category_header">{title}</h2> ||
                this.props.depth === 2 && <h3 className="css_category_header">{title}</h3> ||
             // this.props.depth === 3 && <h5 className="css_category_header">{title}</h5>
                <h5 className="css_category_header">{title}</h5>
            );

            if( this.props.category__permalink ) {
                assert_soft(this.props.is_need_view);
                const link_url = this.props.category__permalink;
                header = (
                    <LinkMixin
                      to={link_url}
                      children={header}
                      track_info={{
                          category: 'click_on_need_title',
                          action: this.props.category__name,
                      }}
                    />
                );
            }

            return (
                <div>
                    {header}
                </div>
            );
        })();

        const section__desc = (() => {
            if( ! this.props.category__desc ) {
                return null;
            }
            const desc = text_search.highlight_search_match(this.props.category__desc, this.props.full_text_search_value);
            return <div style={{display: 'inline-block'}} className="css_header_description">{desc}</div>;
        })();

        const section__topics = (() => {
            if( ! this.props.is_need_view ) {
                return null
            }
            if( this.props.category__topics.length === 0 ) {
                return null;
            }
            return (
                <div style={{display: 'inline-block', marginLeft: 10}}>{
                    this.props
                    .category__topics
                    .map(topic_name =>
                        <TopicSnippet
                            key={topic_name}
                            catalog_name={this.props.catalog_name}
                            topic_name={topic_name}
                            full_text_search_value={this.props.full_text_search_value}
                            topic_search_value={this.props.topic_search_value}
                        />
                    )
                }</div>
            );
        })();

        const section__elaboration = (() => {
            if( ! this.props.category__elaboration ) {
                return null;
            }
            const elaboration = (
                this.props.category__elaboration
                .split('\n\n')
                .map(text => text_search.highlight_search_match(text, this.props.full_text_search_value))
                .map((text, i) => <p key={i}>{text}</p>)
            );
            return <div className="sel_category_elaboration">{elaboration}</div>;
        })();

        const section__resources = (() => {
            if( this.props.popular_board === null ) {
                return null;
            }
            const supports_adding = (
                AddResourceSnippet.supported_entries_type.includes(this.props.resource_adder.entries_type) &&
                this.props.tag_accepts_new_entries
            );
            return (
                <RenderDelayer dontDelayRender={this.props.has_rendered_before===false}>
                    <div className="sel_category_resources">
                        <PopularBoardSnippet.component { ...this.props.popular_board } full_text_search_value={this.props.full_text_search_value} need__missing_words={this.props.need__missing_words}/>
                        <ResourcesGraveyardCribSnippet.component { ...this.props.resources_graveyard_crib } />
                        { this.props.resource_adder.is_meta_catalog &&
                            <CatalogAdder />
                        }
                        { supports_adding &&
                            <LibraryAdder { ...this.props.resource_adder } />
                        }
                        <div className="css_category_resource_list_end" />
                    </div>
                </RenderDelayer>
            );
        })();

        const section__resource_categories = (
            this.props.is_category_tree && (
                <ResourceCategoriesSnippet { ...this.props.resource_categories } />
            )
        );

        const section__need_title = (
            this.props.is_need_view && (
                <h4 className="sel_section_title">Need</h4>
            )
        );

        const section__end = (
            ! this.props.is_need_view && (
                <div className="css_category_end" />
            )
        );

        const ret_props = {
            className: classNames(
              "css_category",
              "css_depth_"+this.props.depth,
              (
                  this.props.entries_type==='web_entries' ?
                        "css_category__web_entries" :
                        "css_category__npm_entries"
              )
            ),
            children: [
                section__need_title,
                section__breadcrumb,
                section__header,
                section__desc,
                section__topics,
                section__elaboration,
                section__resources,
                section__resource_categories,
                section__end,
            ],
        };

        if( this.props.is_category_tree ) {
            return (
                <Scroll.Element name={this.props.id}>
                    <div { ...ret_props }/>
                </Scroll.Element>
            );
            /*
            return <Scroll.Element name={this.props.id} { ...ret_props }/>
            */
        }

        return (
            <div { ...ret_props }/>
        );
    }
} 
CategorySnippet.get_props = ({tag, tag_category, categories_resources, category__breadcrumb, parent_category_has_resources, is_first_category, is_category_tree, is_need_view}) => { 
    assert(tag_category);
    assert(tag_category.constructor === Tag, tag_category);
    assert(tag_category.is_markdown_category, tag_category);
    const depth = tag_category.depth;
//  assert(1 <= depth && depth <= 3);
    assert(1 <= depth && depth <= 4);

    const category__resources = categories_resources[tag_category.id];
    assert_soft(!is_need_view || category__resources, tag_category, tag_category.name);
    assert_soft(!category__resources || category__resources.resources_included.length>0, tag_category, tag_category.name);

    const category__title = tag_category.category__title;
    assert_soft(category__title, tag_category);

    const popular_board = (
        ( ! category__resources || category__resources.resources_included.length === 0 ) ? (
            null
        ) : (
            PopularBoardSnippet.get_props({
                tag,
                tag_category,
                resource_list: category__resources.resources_included,
                resource_requests: category__resources.resources_awaiting,
                is_need_view,
            })
        )
    );
    const resources_graveyard_crib = (
        ( ! category__resources || category__resources.resources_included.length === 0 ) ? (
            null
        ) : (
            ResourcesGraveyardCribSnippet.get_props({
                tag,
                tag_category,
                resources_declined: category__resources.resources_declined,
                is_need_view,
            })
        )
    );

    return {
        key: tag_category.id,
        id: tag_category.id,
        tag_accepts_new_entries: tag.display_options.tag_accepts_new_entries,
        is_need_view,
        catalog_name: tag.name,
        category__permalink: is_need_view && tag_category.category__permalink,
        category__name: tag_category.name,
        category__title,
        category__desc: tag_category.category__desc,
        category__elaboration: tag_category.category__elaboration,
        category__topics: tag_category.category__topics,
        category__breadcrumb: (is_first_category && !parent_category_has_resources) ? '' : category__breadcrumb,
        depth,
        resource_adder: {
            is_meta_catalog: tag.is_meta_list,
            markdown_list__name: tag_category.markdown_list_tag.name,
            tag_category_id: tag_category.id,
            category__title,
            entries_type: tag_category.entries_type,
            is_need_view,
        },
        popular_board,
        resources_graveyard_crib,
        resource_categories: (
            ResourceCategoriesSnippet.get_props({
                parent_category_has_resources: popular_board!== null || resources_graveyard_crib!== null,
                tag,
                tag_category,
                categories_resources,
                category__breadcrumb: (
                    /*
                    (category__breadcrumb ? category__breadcrumb+' > ' : '')+category__title
                    /*/
                    (category__breadcrumb||'') + category__title + ' > '
                    //*/
                ),
                is_category_tree,
                is_need_view,
            })
        ),
        is_category_tree,
    };
}; 

const ResourceCategoriesSnippet = props => { 
    return (
        <div>{
            props.category_list.map(category_props => <CategorySnippet { ...category_props } />)
        }</div>
    );
}; 

ResourceCategoriesSnippet.get_props = ({tag, tag_category, categories_resources, category__breadcrumb, parent_category_has_resources, is_need_view}) => { 
    assert(tag);
    assert(tag.constructor === Tag);
    assert(tag.is_markdown_list);
    assert(!tag_category || tag_category.is_markdown_category);
    assert_soft([true, false].includes(is_need_view));
    const current_tag = tag_category || tag;
    return {
        category_list: (
            current_tag
            .child_tags
            .map((tag__child, i) =>
                CategorySnippet.get_props({
                    tag,
                    tag_category: tag__child,
                    categories_resources,
                    category__breadcrumb,
                    parent_category_has_resources,
                    is_first_category: i===0,
                    is_category_tree: true,
                    is_need_view,
                })
            )
        ),
    };
}; 

export {CategorySnippet, ResourceCategoriesSnippet};
