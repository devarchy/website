import React from 'react';
import Promise from 'bluebird';
import assert from 'assert';

import Thing from '../../thing';
import Resource from '../../thing/resource';
import Tag from '../../thing/tag';

import CollaseMixin from '../mixins/collapse';

import ResourceRequestListSnippet from '../snippets/resource-request-list';
import ResourceCategoriesSnippet from '../snippets/resource-categories';

Promise.longStackTraces();

const EntryRequests = props => { 
    const section__resource_requests =
        <div>
            {
                props.resource_list === null && (
                    <span style={{fontSize: '0.9em'}}>
                        <i>No new requests</i>
                    </span>
                ) || (
                    <ResourceRequestListSnippet.component
                      { ...props.resource_list }
                    />
                )
            }
        </div>;

    return section__resource_requests;
} 

const CommunityCurationIntro = React.createClass({ 
    getInitialState: () => ({expanded: false}),
    toggle_expanded: function(){ this.setState({expanded: !this.state.expanded}); return false },
    render: function(){
        return (
            <div
                style={{
                  backgroundColor: 'rgba(0,0,0,0.025)',
                  borderRadius: 5,
                  padding: '10px 5px 15px 20px',
                }}
            >
                <div
                  className="css_light_paragraph"
                  style={{
                    textTransform: 'uppercase',
                    color: '#888',
                  }}
                >
                    New requests
                </div>
                <div style={{paddingTop: 10}}>
                    <EntryRequests resource_list={this.props.new_requests} />
                    <a onClick={this.toggle_expanded} style={{width: 40, padding: '3px 0', display: 'inline-block'}} className="css_da">{this.state.expanded?"Less ":"More"}</a>
                    <CollaseMixin.component isOpened={this.state.expanded}>
                        <div style={{padding: 3}}></div>
                        <EntryRequests resource_list={this.props.old_requests} />
                    </CollaseMixin.component>
                </div>
            </div>
        );
    },
}); 

const CuratedListIntro = props => { 
    const number_of_pending_entries =
        ((props.old_requests||{}).resource_list||[]).length +
        ((props.new_requests||{}).resource_list||[]).length;

    const catalog_intro = (() => { 
        const github_link =
            <a className="css_da" target="_blank" href={'https://github.com/'+props.tag.markdown_list__github_full_name}>
                <i className="fa fa-github" style={{verticalAlign: 'middle', fontSize: '1.2em', position: 'relative', top: -2, left: 2}}/>
                {' '}
                {props.tag.markdown_list__github_full_name}
            </a>;

        return (
            <div>
                <p className="css_light_paragraph">
                    {props.tag.description__manipulated}
                </p>
                <p className="css_light_paragraph">
                    Synced with {github_link} (two-way sync).
                </p>
                <p className="css_light_paragraph">
                    The catalog consists of <code className="css_da css_inline">{props.tag.number_of_entries - number_of_pending_entries}</code> entries.
                </p>
            </div>
        );
    })(); 

    return <div>
        { catalog_intro }
        <br/>
        <CommunityCurationIntro number_of_pending_entries={number_of_pending_entries} old_requests={props.old_requests} new_requests={props.new_requests}/>
        <h1 className="css_category_header">{props.tag.display_title__maniuplated}</h1>
    </div>;
}; 

const MarkdownListViewSnippet = props => {
    return <div style={{paddingTop: 10}}>
        <CuratedListIntro { ...props.curated_list_intro } />
        <ResourceCategoriesSnippet.component { ...props.resource_categories } />
    </div>;
};

export default {
    component: MarkdownListViewSnippet,
    get_props: ({tag}) => {
        assert(tag);
        assert(tag.constructor === Tag);
        assert(tag.is_markdown_list);

        const resource_requests__map = {};
        const resource_requests =
            tag
            .resource_reqs
            .filter(r => {
                const treqs =
                    r.tagrequests
                    .filter(t => t.markdown_list_tag === tag);

                treqs.forEach(t => (resource_requests__map[t.id] = resource_requests__map[t.id] || []).push(r));

                assert(treqs.length > 0);

                return true;
            });

        const resource_requests__with_category =
            resource_requests
            .map(resource => ({
                resource,
                category: resource.get_category_request(tag).display_category({without_root: true}),
            }));

        const resources = Resource.list_things({tags: [tag], awaiting_approval: 'EXCLUDE'});

        const NEW_REQUESTS_LIMIT = 5;

        return {
            curated_list_intro: {
                tag: {
                    display_title__maniuplated: tag.display_title__maniuplated,
                    markdown_list__github_full_name: tag.markdown_list__github_full_name,
                    description__manipulated: tag.description__manipulated,
                    number_of_entries: resources.length,
                },
                new_requests: (() => {
                    const new_requests = resource_requests__with_category.slice(0,NEW_REQUESTS_LIMIT);
                    if( new_requests.length === 0 ) {
                        return null;
                    }
                    return ResourceRequestListSnippet.get_props({
                        resource_list: new_requests,
                    });
                })(),
                old_requests: (() => {
                    const old_requests = resource_requests__with_category.slice(NEW_REQUESTS_LIMIT);
                    if( old_requests.length === 0 ) {
                        return null;
                    }
                    return ResourceRequestListSnippet.get_props({
                        resource_list: old_requests,
                    });
                })(),
            },
            resource_categories:
                ResourceCategoriesSnippet.get_props({
                    tag,
                    resource_list: resources,
                    resource_requests__map,
                    resource_requests,
                }),
        };
    },
};
