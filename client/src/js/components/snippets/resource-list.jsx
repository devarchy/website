import React from 'react';

import ResourceLineSnippet from '../snippets/resource-line';


const ResourceListSnippet = React.createClass({
    propTypes: {
        resource_list: React.PropTypes.array.isRequired,
    },
    render: function() {
        if( this.props.resource_list.length === 0 ) {
            if( this.props.resources_none_component ) {
                return this.props.resources_none_component;
            }
            return null;
        }

        return (
            <div>{
                this.props.resource_list
                .map(({key, props}) =>
                    <ResourceLineSnippet.component
                      key={key}
                      full_text_search_value={this.props.full_text_search_value}
                      need__missing_words={this.props.need__missing_words}
                      {... props}
                    />
                )
            }</div>
        );
    },
});


export default {
    component: ResourceListSnippet,
    get_props: ({tag, resource_list, date_column_first, resources_none_component, addition_request_view, is_request, is_need_view}) => ({
        resource_list:
            resource_list.map(resource => ({
                key:resource.key,
                props: ResourceLineSnippet.get_props({tag, resource, date_column_first, addition_request_view, is_request, is_need_view}),
            })),
        resources_none_component,
    }),
};
