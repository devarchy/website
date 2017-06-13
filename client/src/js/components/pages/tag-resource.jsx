import React from 'react';
import assert_soft from 'assertion-soft';

import assert from 'assertion-soft';
import route_spec from '../../util/route_spec';
import Promise from 'bluebird';

import Tag from '../../thing/tag';
import Resource from '../../thing/resource';

import NotFound404Page from '../pages/not-found-404';
import TagPage from './tag';

import LinkMixin from '../mixins/link';

import ResourceDetailsSnippet from '../snippets/resource-details';
import {CatalogLogo} from '../snippets/catalog-title';

import user_tracker from '../../user_tracker';

Promise.longStackTraces();


const TagResourcePage = ({resource, tag_catalog, tag_category}) => {

    const header = (
        <div
          className="css_sidebar_padding"
          style={{
            width: '100%',
            display: 'flex',
            marginTop: 25,
            marginBottom: 30,
          }}
        >
            <div style={{flex: 0.6}}/>
            <div>
                <div>
                    <LinkMixin to={TagPage.page_route_spec.interpolate_path({tag_name: tag_catalog.name})}>
                        <div style={{display: 'inline-block', verticalAlign: 'middle'}}>
                            <div style={{height: 16, width: 16}}>
                                <CatalogLogo tag={tag_catalog} />
                            </div>
                        </div>
                        {' '}
                        <div style={{display: 'inline-block', verticalAlign: 'middle'}}>
                            {tag_catalog.display_options.tag_title}{' '}
                        </div>
                        <div style={{display: 'inline-block', verticalAlign: 'middle'}}>
                            &nbsp;
                            {'> '}
                            { tag_category && (
                                tag_category.category__path({without_root: true}) +
                                ' > '
                            )}
                        </div>
                    </LinkMixin>
                </div>
                <div
                  style={{marginTop: 1, fontSize: '1.25em'}}
                >
                    <div className="css_catalog_title">
                        {resource.resource_name}
                    </div>
                </div>
            </div>
            <div style={{flex: 1}}/>
        </div>
    );
        /*
        <div className="css_header" style={{justifyContent: 'space-between'}}>
            <div
              className="css_catalog_title"
              style={{marginLeft: 14}}
            >
                {resource.resource_name}
            </div>
            <LinkMixin to={TagPage.page_route_spec.interpolate_path({tag_name: tag_catalog.name})}>
                <CatalogTitleSnippet tag={tag_catalog} style={{fontSize: '0.7em', marginRight: 10}}/>
            </LinkMixin>
        </div>
        */

    return (
        <div>
            {header}
            <ResourceDetailsSnippet.component tag={tag_catalog} resource={resource} style={{marginTop: -20}}/>
        </div>
    );
};

export default {
    page_route_spec: route_spec.from_crossroads_spec('/{tag_name}/{resource_human_id}'),
    component: TagResourcePage,
    hide_sidebar: true,
    fetch: function({route: {params: {tag_name, resource_human_id}}}) {
        assert_soft(tag_name);
        assert_soft(resource_human_id);
        return (
            Tag.retrieve_categories_and_resources(tag_name)
            .then(() => {
                const {resource} = Resource.get_resource_by_name({tag_name, resource_human_id});
                if( ! resource ) {
                    return;
                }
                return ResourceDetailsSnippet.fetch({resource_id: resource.id});
            })
        );
    },
    get_page_head: ({route: {params: {tag_name, resource_human_id}}}) => {
        const {resource} = Resource.get_resource_by_name({tag_name, resource_human_id});
        if( ! resource ) {
            return {
                title: resource_human_id+' - loading...',
                description: 'Loading data for `'+resource_human_id+'`',
                hide_sidebar: true,
                dont_index: true,
            };
        }
        assert_soft(resource.resource_name, resource);
        assert_soft(resource.resource_desc, resource);
        return {
            title: resource.resource_name,
            description: resource.resource_desc,
            dont_index: true,
            canonical_url: resource.github_full_name ? ("https://github.com/"+resource.github_full_name) : null,
        };
    },
    element: function({route: {params: {tag_name, resource_human_id}}}) {
        const {resource, tag} = Resource.get_resource_by_name({tag_name, resource_human_id});

        if( ! resource ) {
            const text = (
                <div>
                    Resource
                    {' '}
                    <code className="css_da css_inline">{resource_human_id}</code>
                    {' '}
                    not found in Catalog
                    {' '}
                    <code className="css_da css_inline">{tag_name}</code>
                    {' '}
                    .
                </div>
            );
            return <NotFound404Page.component text={text} />;
        }

        if( typeof window !== "undefined" ) {
            if( (window.document.referrer||'').startsWith(window.location.origin) ) {
                user_tracker.trackers.track_resource_view({viewed_in: 'resource_dedicated_page'});
            } else {
                user_tracker.log_event({
                    category: 'rare_events',
                    action: 'resource dedicated page',
                    not_an_action: true,
                });
            }
        }

        TagPage.generate_css({tag});

        const tag_category = resource.get_a_category(tag);

        return <TagResourcePage resource={resource} tag_catalog={tag} tag_category={tag_category} />;
    },
};
