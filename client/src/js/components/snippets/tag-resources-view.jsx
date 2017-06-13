import React from 'react';

import Resource from '../../thing/resource';

import ResourceListSnippet from '../snippets/resource-list';

const NEW_LIMIT = 300;

const Header = props => <h3 id={props.id} className="css_da">{props.text}</h3>;

const TagResourcesViewSnippet = props =>
    <div>
        <div>
            <h2 className="css_da">{props.tag.name}</h2>
            <div><b>{props.tag.number_of_entries}</b> entries</div>
            <div>
                <a href="#new">
                    {NEW_LIMIT} latest entries sorted by repository creation date
                </a>
                <br/>
                <a href="#popular">
                    All entries sorted by popularity
                </a>
            </div>
        </div>
        <div style={{height: 70}}/>
        <Header text='New' id="new"/>
        <ResourceListSnippet.component {...props.resource_list__new} />
        <div style={{height: 200}}/>
        <Header text='Popular' id="popular"/>
        <ResourceListSnippet.component {...props.resource_list__popular} />
    </div>;


export default {
    component: TagResourcesViewSnippet,
    get_props: ({tag}) => {
        const resource_list = Resource.list_things({tags: [tag]});
        return {
            tag: {
                name: tag.name,
                number_of_entries: resource_list.length,
            },
            resource_list__popular:
                ResourceListSnippet.get_props({
                    tag,
                    resource_list,
                    is_need_view: false,
                }),
            resource_list__new:
                ResourceListSnippet.get_props({
                    tag,
                    resource_list: Resource.list_things({tags: [tag], order: {newest: true}}).slice(0, NEW_LIMIT),
                    is_need_view: false,
                }),
        }
    },
};
