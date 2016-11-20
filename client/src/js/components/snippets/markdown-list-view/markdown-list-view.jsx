import React from 'react';
import Promise from 'bluebird';
import assert from 'assert';

import Thing from '../../../thing';
import Resource from '../../../thing/resource';
import Tag from '../../../thing/tag';

import CollaseMixin from '../../mixins/collapse';

import ResourceRequestListSnippet from '../../snippets/resource-request-list';
import ResourceCategoriesSnippet from '../../snippets/resource-categories';

import GoMarkGithub from 'react-icons/lib/go/mark-github';

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
            <div>
                <div
                  className="css_light_paragraph css_heading"
                  style={{
                    fontSize: '1.4em',
                  }}
                >
                    New requests
                </div>
                <div className="css_new_requests">
                    <EntryRequests resource_list={this.props.new_requests} />
                    {
                        this.props.old_requests && <div>
                            <a onClick={this.toggle_expanded} style={{width: 40, padding: '3px 0', display: 'inline-block'}} className="css_da">{this.state.expanded?"Less ":"More"}</a>
                            <CollaseMixin.component isOpened={this.state.expanded}>
                                <div style={{padding: 3}}></div>
                                <EntryRequests resource_list={this.props.old_requests} />
                            </CollaseMixin.component>
                        </div>
                    }
                </div>
            </div>
        );
    },
}); 

const CuratedListIntro = props => { 
    const catalog_intro = (() => { 
        const github_link =
            <a className="css_da" target="_blank" href={'https://github.com/'+props.tag.markdown_list__github_full_name}>
                <GoMarkGithub style={{verticalAlign: 'middle', fontSize: '1em', position: 'relative', top: -1, left: 1, marginLeft: 0}}/>
                {' '}
                {props.tag.markdown_list__github_full_name}
            </a>;

        return (
            <div>
                <p className="css_light_paragraph">
                    {props.tag.description__prefix}
                    {' '}
                    <code className="css_da css_inline" style={{verticalAlign: 'middle', paddingTop: 2}}>{props.tag.number_of_entries}</code>
                    {' '}
                    {props.tag.description__suffix}
                </p>
                <p className="css_light_paragraph">
                    Synced with {github_link} (two-way sync).
                </p>
            </div>
        );
    })(); 

    const catalog_logo = (() => { 
        const img_url = props.tag.logo__manipulated;
        return (
            img_url !== null &&
              <div
                style={{
                    backgroundImage: 'url('+img_url+')',
                    height: '100%',
                    width: '100%',
                    backgroundSize: 'contain',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: '100%',
                    display: 'inline-block',
                }}
              />
        );
    })(); 

    const catalog_title = (() => {
        const words = props.tag.display_title__manipulated.split(' ');
        if( words.length === 1 ) return words[0];
        const text_top = words.slice(0,words.length/2).join(' ');
        const text_bot = words.slice(words.length/2).join(' ');
        if( text_top.length + text_bot.length < 10 ) {
            return text_top + ' ' + text_bot;
        }
        return text_top + '\n' + text_bot;
    })();

    return <div>
        <div>
            <div style={{textAlign: 'center', paddingTop: 8, paddingBottom: 28}}>
                <div style={{display: 'inline-block', verticalAlign: 'middle', width: 75, height: 75, marginRight: 16}}>
                    {catalog_logo}
                </div>
                <div
                    className="css_catalog_title"
                >
                    {catalog_title}
                </div>
            </div>
            {catalog_intro}
        </div>
        <br/>
        <CommunityCurationIntro old_requests={props.old_requests} new_requests={props.new_requests}/>
    </div>;
}; 

const MarkdownListViewSnippet = props => {
    return <div style={{paddingTop: 10}}>
        <CuratedListIntro { ...props.curated_list_intro } />
        <div style={{height: 23}}/>
        <ResourceCategoriesSnippet.component { ...props.resource_categories } />
    </div>;
};

export default {
    component: MarkdownListViewSnippet,
    get_props: ({tag}) => {
        assert(tag);
        assert(tag.constructor === Tag);
        assert(tag.is_markdown_list);

        const resource_requests = tag.resource_reqs;

        const resources_awaiting_upvotes = (() => {
            const map = {};
            resource_requests
            .forEach(resource => {
                const treqs =
                    resource.tagrequests
                    .filter(({tag__markdown_list}) => tag__markdown_list === tag);

                assert(treqs.length > 0);

                treqs
                .filter(({tag__markdown_list, tag__category}) => {
                    const is_declined = resource.is_declined_in(tag__markdown_list);
                    const is_included = tag__category && tag__category.includes_resource(resource);
                    return tag__category && !is_declined && !is_included;
                })
                .forEach(({tag__category}) => (map[tag__category.id] = map[tag__category.id] || []).push(resource));
            });
            return map;
        })();

        const resource_requests__with_category =
            resource_requests
            .map(resource => {
                const tag__category = resource.get_category_request(tag);
                const category = tag__category ? tag__category.display_category({without_root: true}) : null
                return {
                    resource,
                    category,
                };
            });

        const resources = Resource.list_things({tags: [tag]});

        const NEW_REQUESTS_LIMIT = 5;

        return {
            curated_list_intro: {
                tag: {
                    logo__manipulated: tag.logo__manipulated,
                    display_title__manipulated: tag.display_title__manipulated,
                    markdown_list__github_full_name: tag.markdown_list__github_full_name,
                    description__prefix: tag.description__prefix,
                    description__suffix: tag.description__suffix,
                    number_of_entries: resources.length - Object.values(resources_awaiting_upvotes).reduce((curr, prev) => curr.concat(prev), []).length,
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
                    resources_awaiting_upvotes,
                    resource_requests,
                }),
        };
    },
};
