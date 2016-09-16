import React from 'react';
import classNames from 'classnames';
import assert from 'assert';

import Thing from '../../thing/thing';
import Resource from '../../thing/resource';
import Tag from '../../thing/tag';

import LinkMixin from '../mixins/link';
import ResourceListSnippet from '../snippets/resource-list';


const PopularResourcesSnippet = ({i, text, resource_list_data})  => {
    if( resource_list_data.resource_list.length === 0 ) {
        return null;
    }

    return (
        <div
          key={i}
        >
            <h6
              className="css_da"
              style={{marginTop: 5, marginBottom: 3}}
            >
                {text}
            </h6>
            <ResourceListSnippet.component
              { ... resource_list_data}
            />
        </div>
    );
};
PopularResourcesSnippet.get_props = ({age_max, age_min, text, i, resource_list, resource_requests, tag, awaiting_approval='EXCLUDE'}) => {
    assert(['ONLY', 'EXCLUDE'].includes(awaiting_approval));

    const is_request = awaiting_approval === 'ONLY';

    const resources = (() => {
        if( is_request ) {
            return resource_requests;
        }
        return (
            Resource.list_things({
                age_min, age_max,
                list: resource_list,
            })
        );
    })();

    return {
        i,
        text,
        resource_list_data: ResourceListSnippet.get_props({resource_list: resources, is_request}),
    }
};


const BoardSnippet = props =>
    <div>{
        props.sections
        .map(section_props =>
            PopularResourcesSnippet(section_props)
        )
    }</div>;


export default {
    component: BoardSnippet,
    get_props: ({tag, resource_list, resource_requests}) => {
        assert( tag );
        assert( tag.constructor === Tag );
        assert( tag.is_markdown_category );

        assert( resource_list );
        assert( resource_list.constructor === Array );

        assert( resource_requests );
        assert( resource_requests.constructor === Array );

        const ONE_YEAR = 365;
        const THREE_YEARS = ONE_YEAR*3;
        const SIX_YEARS = ONE_YEAR*6;

        return {
            sections:
                [
                    {
                        age_max: ONE_YEAR,
                        text: "< 1 year old",
                    },
                    {
                        age_min: ONE_YEAR,
                        age_max: THREE_YEARS,
                        text: "< 3 years old",
                    },
                    {
                        age_min: THREE_YEARS,
                        age_max: SIX_YEARS,
                        text: "< 6 years old",
                    },
                    {
                        age_min: SIX_YEARS,
                        text: "Older",
                    },
                    {
                        awaiting_approval: 'ONLY',
                        text: "Awaiting upvotes",
                    },
                ]
                .map((spec, i) =>
                    PopularResourcesSnippet.get_props(
                        Object.assign({tag, resource_list, resource_requests}, spec, {i})))
        };

    },
};
