import React from 'react';
import classNames from 'classnames';
import assert from 'assertion-soft';

import Thing from '../../thing/thing';
import Resource from '../../thing/resource';
import Tag from '../../thing/tag';

import ResourceListSnippet from '../snippets/resource-list';


const PopularResourcesSnippet = ({i, text, resource_list_data, full_text_search_value, need__missing_words})  => {
    if( resource_list_data.resource_list.length === 0 ) {
        return null;
    }

    return (
        <div
          key={i}
        >
            { text && <h6 className="css_da css_category_resource_list_header">{text}</h6> }
            <ResourceListSnippet.component
              full_text_search_value={full_text_search_value}
              need__missing_words={need__missing_words}
              { ... resource_list_data}
            />
        </div>
    );
};
PopularResourcesSnippet.get_props = ({tag, age_max, age_min, age_missing, text, i, resource_list, resource_requests, is_request, is_need_view}) => {

    const resources = (() => {
        if( is_request ) {
            return resource_requests;
        }
        return (
            Resource.list_things({
                age_min, age_max, age_missing,
                list: resource_list,
            })
        );
    })();

    return {
        i,
        text,
        resource_list_data: ResourceListSnippet.get_props({tag, resource_list: resources, is_request, is_need_view}),
    }
};


const PopularBoardSnippet = ({parts, full_text_search_value, need__missing_words}) => {
    return (
        <div>{
            parts
            .map(part =>
                PopularResourcesSnippet(Object.assign(part, {full_text_search_value, need__missing_words}))
            )
        }</div>
    );
};

export default {
    component: PopularBoardSnippet,
    get_props: ({tag, resource_list, resource_requests, is_need_view}) => {
        assert( tag );
        assert( tag.constructor === Tag );
        assert( tag.is_markdown_list );

        assert( resource_list );
        assert( resource_list.constructor === Array );

        assert( resource_requests );
        assert( resource_requests.constructor === Array );

        const ONE_YEAR = 365;
        const THREE_YEARS = ONE_YEAR*3;
        const SIX_YEARS = ONE_YEAR*6;

        let parts = (
            [
                {
                    age_max: ONE_YEAR,
                    text: "0-11 months old",
                },
                {
                    age_min: ONE_YEAR,
                    age_max: THREE_YEARS,
                    text: "1-2 years old",
                },
                {
                    age_min: THREE_YEARS,
                    age_max: SIX_YEARS,
                    text: "3-5 years old",
                },
                {
                    age_min: SIX_YEARS,
                    text: "6+ years old",
                },
                {
                    age_missing: true,
                    text: "Unknown age",
                },
                {
                    is_request: true,
                    text: "Awaiting upvotes",
                },
            ]
        );

        parts = parts.map((spec, i) =>
            PopularResourcesSnippet.get_props(
                Object.assign({tag, resource_list, resource_requests, is_need_view}, spec, {i})))

        return {
            parts,
        };

    },
};
