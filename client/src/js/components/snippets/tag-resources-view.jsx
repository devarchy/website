import React from 'react';

import Resource from '../../thing/resource';

import ResourceListSnippet from '../snippets/resource-list';


const Header = props => <h3 className="css_da">{props.text}</h3>;

const TagResourcesViewSnippet = props =>
    <div>
        <div>
            <h2 className="css_da">{props.tag.display_title}</h2>
            <div><b>{props.tag.number_of_entries}</b> entries</div>
        </div>
        <Header text='New'/>
        <ResourceListSnippet.component resource_list={props.resource_list__new} />
        <Header text='Popular'/>
        <ResourceListSnippet.component resource_list={props.resource_list__popular} />
    </div>;


export default {
    component: TagResourcesViewSnippet,
    get_props: ({tag}) => {
        const resource_list = Resource.list_things({tags: [tag]});
        return {
            tag: {
                display_title: tag.display_title,
                number_of_entries: resource_list.length,
            },
            resource_list__popular:
                ResourceListSnippet.get_props({
                    resource_list,
                }).resource_list,
            resource_list__new:
                ResourceListSnippet.get_props({
                    resource_list: Resource.list_things({tags: [tag], order: {newest: true}}).slice(0, 500),
                }).resource_list,
        }
    },
};
