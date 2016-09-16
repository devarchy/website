import React from 'react';
import assert from 'assert';

import Thing from '../../../thing';
import Resource from '../../../thing/resource';
import Tag from '../../../thing/tag';

import Scroll from 'react-scroll';

import PopularBoardSnippet from '../popular-board';
import AddResourceSnippet from '../../snippets/add-resource';
import CollapseMixin from '../../mixins/collapse';


const ResourceAdder = React.createClass({ 
    propTypes: {
        markdown_list__name: React.PropTypes.string.isRequired,
        category__name: React.PropTypes.string.isRequired,
    },
    getInitialState: () => ({expanded: false}),
    toggle: function(){
        this.setState({expanded: ! this.state.expanded});
    },
    render: function() {
        const header =
            <div>
                <button
                  className="css_da css_secondary_button css_color_red"
                  style={{fontSize: '0.75em'}}
                  onClick={this.toggle}
                >
                    <span
                      className={this.state.expanded?"":"css_color_contrib"}
                      style={{transition: 'color 0.5s'}}
                    >
                        <i
                          className="fa fa-plus css_da"
                          style={{transform: this.state.expanded && 'rotate(45deg)', transition: 'transform 0.3s'}}
                        />
                        {' '}
                        <span>
                            { this.state.expanded ? 'Close Form' : 'Add Entry' }
                        </span>
                    </span>
                </button>
            </div>;

        const body =
            <CollapseMixin.component isOpened={this.state.expanded}>
                <AddResourceSnippet.component
                  tag__markdown_list__name={this.props.markdown_list__name}
                  tag__category__name={this.props.category__name}
                />
            </CollapseMixin.component>;

        return (
            <div
              style={{marginTop: 3, marginLeft: 137}}
            >
                <div>
                    { header }
                    { body }
                </div>
            </div>
        );
    },
}); 

const CategorySnippet = React.createClass({ 
 // shouldComponentUpdate: () => false,
    render: function(){

        const section__header = (() => {
            return (
                this.props.depth === 1 && <h2 className="css_category_header">{this.props.display_title}</h2> ||
                this.props.depth === 2 && <h3 className="css_category_header">{this.props.display_title}</h3> ||
                this.props.depth === 3 && <h5 className="css_category_header">{this.props.display_title}</h5>
            );
        })();

        const section__definition = (() => {
            if( ! this.props.definition ) {
                return null;
            }
            return <div>
                <em style={{fontSize: '0.9em'}}>{this.props.definition}</em>
            </div>;
        })();

        const section__resources = (() => {
            if( this.props.popular_board === null ) {
                return null;
            }
            return <div>
                <PopularBoardSnippet.component { ...this.props.popular_board } />
                <ResourceAdder { ...this.props.resource_adder } />
            </div>;
        })();

        const section__resource_categories = (() => {
            return <ResourceCategoriesSnippet { ...this.props.resource_categories } />;
         })();

        return (
            <Scroll.Element
              name={this.props.name}
              className="css_category"
            >
                { section__header }
                { section__definition }
                { section__resources }
                { section__resource_categories }
            </Scroll.Element>
        );

    },
}); 

const ResourceCategoriesSnippet = props => {
    return <div>{
        props.category_list.map(category_props => <CategorySnippet { ...category_props } />)
    }</div>;
}

export default {
    component: ResourceCategoriesSnippet,
    get_props: function({tag, resource_list, resource_requests__map, resource_requests}) {
        assert(tag);
        assert(tag.constructor === Tag);
        assert(tag.is_markdown_list || tag.is_markdown_category);
        return {
            category_list: tag.child_tags.map(tag__child => {
                assert(tag__child);
                assert(tag__child.constructor === Tag);
                assert(tag__child.is_markdown_category);
                assert(1 <= tag__child.depth && tag__child.depth <= 3);
             // const resource_list__child = Resource.list_things({tags: [tag__child], list: resource_list, awaiting_approval: 'INCLUDE'});
                const resource_list__child = tag__child.tagged_resources.map(({github_full_name}) => {
                    const resource = Resource.get_by_github_full_name(github_full_name);
                    assert(resource, "couldn't find "+github_full_name);
                    return resource;
                });
                const resource_requests__child = resource_requests__map[tag__child.id]||[];
             // const resource_requests__child = Resource.list_things({tags: [tag__child], awaiting_approval: 'ONLY', list: resource_requests});
                return {
                    key: tag__child.id,
                    name: tag__child.name,
                    definition: tag__child.definition,
                    display_title: tag__child.display_title,
                    depth: tag__child.depth,
                    resource_adder: {
                        markdown_list__name: tag__child.markdown_list_tag.name,
                        category__name: tag__child.name,
                    },
                    popular_board: (
                        resource_list__child.length === 0 ? null : PopularBoardSnippet.get_props({tag: tag__child, resource_list: resource_list__child, resource_requests: resource_requests__child})
                    ),
                    resource_categories: this.get_props({tag: tag__child, resource_list, resource_requests__map, resource_requests}),
                };
            }),
        };
    },
};
