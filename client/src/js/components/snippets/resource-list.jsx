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

        return <div>{
            this.props.resource_list
            .map(({key, props}) =>
                <ResourceLineSnippet.component
                  key={key}
                  {... props}
                />
            )
        }</div>;
    },
});


export default {
    component: ResourceListSnippet,
    get_props: ({resource_list, date_column_first, resources_none_component, addition_request_view, is_request}) => ({
        resource_list:
            resource_list.map(resource => ({
                key:resource.key,
                props: ResourceLineSnippet.get_props({resource, date_column_first, addition_request_view, is_request}),
            })),
        resources_none_component,
    }),
};
