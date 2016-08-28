import React from 'react';
import assert from 'assert';
import crossroads from 'crossroads';
import Promise from 'bluebird';

import Tag from '../../thing/tag';
import Resource from '../../thing/resource';

import TagResourcesViewSnippet from '../snippets/tag-resources-view';
import MarkdownListViewSnippet from '../snippets/markdown-list-view';

import NotFound404Page from '../pages/not-found-404';

Promise.longStackTraces();


const TagPage = props =>
    props.is_markdown_view ?
        <MarkdownListViewSnippet.component { ...props } /> :
        <TagResourcesViewSnippet.component { ...props } /> ;

export default {
    route: crossroads.addRoute('/{tag_name}'),
    component: TagPage,
    fetch_promise: null,
    is_fetching: false,
    fetch: function({route: {params: {tag_name}}}) {
        assert(tag_name);
        this.is_fetching = true;
        this.fetch_promise =
            Promise.all([
                Tag.retrieve_by_name(tag_name),
                Resource.retrieve_things__by_tag({tag_name}),
            ])
            .then(() => {
                this.is_fetching = false
                this.fetch_promise = null;
            });
        return this.fetch_promise;
    },
    get_props: function({tag}) {
        assert( !this.is_fetching );
        const props =
            tag.is_markdown_list ?
                MarkdownListViewSnippet.get_props({tag}) :
                TagResourcesViewSnippet.get_props({tag})
        props.is_markdown_view = tag.is_markdown_list;
        return props;
    },
    element: function({route: {params: {tag_name}}}) {
        assert( !this.is_fetching );
        const tag = Tag.get_by_name(tag_name);
        if( ! tag ) {
            const text = <div>
                The list <code className="css_da css_inline">{tag_name}</code> was not found.
                <br/>
                Select another list.
            </div>;
            return <NotFound404Page.component text={text} />;
        }
        const props = this.get_props({tag});
        return (
            <TagPage { ...props } />
        );
    },
    get_page_head: ({route: {params: {tag_name}}}) => {
        const tag = Tag.get_by_name(tag_name);
        if( ! tag ) {
            return {
                title: tag_name+' - loading...',
            };
        }
        return {
            title: tag.display_title__strip_awesome,
            description: tag.description,
        };
    },
};
