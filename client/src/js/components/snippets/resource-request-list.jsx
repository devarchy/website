import React from 'react';

import ResourceLineSnippet from '../snippets/resource-line';


const ResourceRequestListSnippet = React.createClass({
    propTypes: {
        resource_list: React.PropTypes.array.isRequired,
    },
    render: function() {
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
    component: ResourceRequestListSnippet,
    get_props: ({resource_list}) => ({
        resource_list:
            resource_list.map(({resource, category}) => ({
                key: resource.key,
                props: ResourceLineSnippet.get_props({resource, addition_request_view: category, is_request: true}),
            })),
    }),
};

