import React from 'react';
import Promise from 'bluebird';
import assert from 'assert';

import Thing from '../../thing';
import Resource from '../../thing/resource';
import Tag from '../../thing/tag';

import ResourceListSnippet from '../snippets/resource-list';
import ResourceCategoriesSnippet from '../snippets/resource-categories';

Promise.longStackTraces();


const CuratedListIntro = props => { 
    const github_link =
        <a className="css_da" target="_blank" href={'https://github.com/'+props.tag.markdown_list__github_full_name}>
            <i className="fa fa-github" style={{verticalAlign: 'middle', fontSize: '1.2em', position: 'relative', top: -1, left: 2}}/>
            {' '}
            {props.tag.markdown_list__github_full_name}
        </a>;

    const section__resource_requests =
        <div>
            {
                props.resource_list === null && (
                    <span style={{fontSize: '0.9em'}}>
                        <i>No entries currently awaiting approval</i>
                    </span>
                ) || (
                    <ResourceListSnippet.component
                      { ...props.resource_list }
                    />
                )
            }

        </div>;

    return <div>
        <p style={{fontSize: '1.1em'}}>
            <i>{props.tag.display_title}</i>
            {' \u2014 '}
            {props.tag.description}
            <br/>
            Synced with {github_link} (two-way sync).
            <br/>
            All <code className="css_da css_inline">{props.tag.number_of_entries}</code> entries of this list are displayed.
        </p>
        <p style={{fontSize: '1.1em', marginBottom: 7}}>
            Following new entries are awaiting approval.
            Anyone can approve an entry.
        </p>
        { section__resource_requests }
        <br />
        <h1 className="css_category_header">{props.tag.display_title}</h1>
    </div>;
}; 

const MarkdownListViewSnippet = props => {
    return <div>
        <CuratedListIntro { ...props.curated_list_intro } />
        <ResourceCategoriesSnippet.component { ...props.resource_categories } />
    </div>;
}


export default {
    component: MarkdownListViewSnippet,
    get_props: ({tag}) => {
        assert(tag);
        assert(tag.constructor === Tag);
        assert(tag.is_markdown_list);
        const resource_requests = tag.resource_requests;
        const resource_list = Resource.list_things({tags: [tag], awaiting_approval: 'EXCLUDE'});
        return {
            curated_list_intro: {
                tag: {
                    display_title: tag.display_title,
                    markdown_list__github_full_name: tag.markdown_list__github_full_name,
                    description: tag.description,
                    number_of_entries: resource_list.length,
                },
                resource_list: (() => {
                    if( resource_requests.length === 0 ) {
                        return null;
                    }
                    return ResourceListSnippet.get_props({
                        resource_list: resource_requests,
                        date_column_first: true,
                    });
                })(),
            },
            resource_categories:
                ResourceCategoriesSnippet.get_props({
                    tag,
                    resource_list,
                    resource_requests__map: (() => {
                        const resource_requests__map = {};
                        assert(tag.is_markdown_list);
                        resource_requests.forEach(p =>
                            p.tagrequests
                            .filter(t => t.markdown_list_tag === tag)
                            .forEach(t => (resource_requests__map[t.id] = resource_requests__map[t.id] || []).push(p))
                        );
                        return resource_requests__map;
                    })(),
                    resource_requests,
                }),
        };
    },
};
