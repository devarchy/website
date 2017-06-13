import React from 'react';
import assert from 'assertion-soft';
import assert_soft from 'assertion-soft';

import user_tracker from '../../../user_tracker';

import Thing from '../../../thing';
import Resource from '../../../thing/resource';
import Tag from '../../../thing/tag';

import CollaseMixin from '../../mixins/collapse';

import ResourceRequestListSnippet from '../../snippets/resource-request-list';
import {ResourceCategoriesSnippet} from '../../snippets/category';
import SocialButtonsSnippet from '../../snippets/social-buttons';
import CatalogTitleSnippet from '../../snippets/catalog-title';
import LinkMixin from '../../mixins/link';

import GoMarkGithub from 'react-icons/lib/go/mark-github';


const EntryRequests = props => { 
    const section__resource_requests =
        <div>
            {
                props.resource_list_data === null && (
                    <span style={{fontSize: '0.9em'}}>
                        <i>No new requests</i>
                    </span>
                ) || (
                    <ResourceRequestListSnippet.component
                      { ...props.resource_list_data }
                    />
                )
            }
        </div>;

    return section__resource_requests;
} 

const CommunityCurationIntro = React.createClass({ 
    getInitialState: () => ({expanded: false}),
    toggle_expanded: function(){
        user_tracker.log_event({
            category: (this.state.expanded?'collapse':'expand')+' new_requests_view',
            action: this.props.tag_name,
        });
        this.setState({expanded: !this.state.expanded});
        return false;
    },
    render: function(){
        return (
            <div>
                <div
                  className="css_light_paragraph"
                  style={{
                    fontSize: '1.4em',
                  }}
                >
                    New requests
                </div>
                <div className="css_header_description">Libraries newly requested that will be added to the catalog after receiving enough upvotes.</div>
                <div className="css_new_requests">
                    <EntryRequests resource_list_data={this.props.new_requests} />
                    {
                        this.props.old_requests && <div>
                            <a
                              onClick={this.toggle_expanded}
                              style={{width: 40, padding: '3px 0', display: 'inline-block'}}
                              className="css_a_gray"
                            >
                                {this.state.expanded?"Less ":"More"}
                            </a>
                            <CollaseMixin.component isOpened={this.state.expanded}>
                                <div style={{padding: 3}}></div>
                                <EntryRequests resource_list_data={this.props.old_requests} />
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
        const github_link = (
            <LinkMixin
              url={'https://github.com/'+props.tag.markdown_list__github_full_name}
              give_page_rank={true}
              text={
                <span>
                    <GoMarkGithub style={{verticalAlign: 'middle', fontSize: '1em', position: 'relative', top: -1, left: 1, marginLeft: 0}}/>
                    {' '}
                    {props.tag.markdown_list__github_full_name}
                </span>
              }
            />
        );

        const description = props.tag.display_options.tag_description__long.split('$n');

        const desc_add = props.tag.display_options.tag_description__addendum;
        const desc_add_i = (() => {
            const desc_add_i = props.tag.display_options.tag_description__addendum__important;
            if( !desc_add_i ) {
                return null;
            }
            return (
                <p className="css_light_paragraph">
                    <b>
                        {desc_add_i}
                    </b>
                </p>
            );
        })();

        const synced_text = props.tag.display_options.tag_accepts_new_entries ? ' (two-way sync)' : '';

        return (
            <div>
                <p className="css_light_paragraph">
                    {description[0]}
                    {' '}
                    <code className="css_da css_inline" style={{verticalAlign: 'middle', paddingTop: 2}}>{props.tag.number_of_entries}</code>
                    {' '}
                    {description[1]}
                    {'.'}

                    { desc_add && ' '+desc_add }
                </p>
                { desc_add_i }
                {/*
                { props.is_programming_stuff &&
                    <p className="css_light_paragraph">
                        Synced with {github_link}{synced_text}.
                    </p>
                }
                */}
            </div>
        );
    })(); 

    const catalog_title = <CatalogTitleSnippet tag={props.tag} />;

    const social_section = <SocialButtonsSnippet.component catalog={props.tag} />

    return <div style={{paddingBottom: 23}}>
        <div className="sel_main_view__responsive_content">
            {catalog_title}
            {social_section}
        </div>
        {catalog_intro}
        <br/>
        { props.tag.display_options.tag_accepts_new_entries &&
            <CommunityCurationIntro tag_name={props.tag.name} old_requests={props.old_requests} new_requests={props.new_requests} />
        }
    </div>;
}; 

const MarkdownListViewSnippet = props => {
    return <div>
        { ! props.is_meta_list && <CuratedListIntro { ...props.curated_list_intro } /> }
        <ResourceCategoriesSnippet { ...props.resource_categories }/>
    </div>;
};

export default {
    component: MarkdownListViewSnippet,
    get_props: ({tag, is_programming_stuff}) => {
        assert(tag);
        assert(tag.constructor === Tag);
        assert(tag.is_markdown_list);
        assert_soft([true, false].includes(is_programming_stuff));

        const {number_of_included_resources, resources__requests, categories_resources} = tag.get_all_info();

        const NEW_REQUESTS_LIMIT = 6;

        return {
            is_meta_list: tag.is_meta_list,
            curated_list_intro: {
                is_programming_stuff,
                tag: {
                    name: tag.name,
                    display_options: tag.display_options,
                    markdown_list__github_full_name: tag.markdown_list__github_full_name,
                    number_of_entries: number_of_included_resources,
                },
                new_requests: (() => {
                    const new_requests = resources__requests.slice(0,NEW_REQUESTS_LIMIT);
                    if( new_requests.length === 0 ) {
                        return null;
                    }
                    return ResourceRequestListSnippet.get_props({
                        tag,
                        resource_list: new_requests,
                    });
                })(),
                old_requests: (() => {
                    const old_requests = resources__requests.slice(NEW_REQUESTS_LIMIT);
                    if( old_requests.length === 0 ) {
                        return null;
                    }
                    return ResourceRequestListSnippet.get_props({
                        tag,
                        resource_list: old_requests,
                    });
                })(),
            },
            resource_categories:
                ResourceCategoriesSnippet.get_props({
                    tag,
                    categories_resources,
                    is_need_view: false,
                }),
        };
    },
};
