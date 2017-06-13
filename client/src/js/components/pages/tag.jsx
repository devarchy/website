import React from 'react';
import assert from 'assertion-soft';
import assert_soft from 'assertion-soft';
import route_spec from '../../util/route_spec';
import Promise from 'bluebird';
import timerlog from 'timerlog';

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

TagPage.get_props = ({tag, meta_data: {is_programming_stuff}}) => {
    const props =
        tag.is_markdown_list ?
            MarkdownListViewSnippet.get_props({tag, is_programming_stuff}) :
            TagResourcesViewSnippet.get_props({tag})
    props.is_markdown_view = tag.is_markdown_list;
    return props;
};

export default {
    page_route_spec: (() => {
        const main_route = route_spec.from_crossroads_spec('/{tag_name}');
        const deviation_route = route_spec.from_crossroads_spec('/{tag_name}/old');
        const routes = [main_route, deviation_route];
        return (
            route_spec({
                path_is_matching:  args => routes.some(route_ => route_.path_is_matching(args)),
                interpolate_path:  main_route.interpolate_path,
                get_route_pattern: main_route.get_route_pattern,
                get_route_params: args => routes.find(route_ => route_.path_is_matching(args)).get_route_params(args),
            })
        );
    })(),
    component: TagPage,
    fetch: function({route: {params: {tag_name}}}) {
        assert(tag_name);
        timerlog({tags: ['client', 'dataflow'], message: 'fetching data for `'+tag_name+'`: START'});
        return (
            Tag.retrieve_categories_and_resources(tag_name)
            .then(output => {
                timerlog({tags: ['client', 'dataflow'], message: 'fetching data for `'+tag_name+'`: END'});
                assert(output && output.constructor===Object);
                output.content_is_single_data_source = true;
                return output;
            })
        );
    },
    element: function({route: {params: {tag_name, route_search_query}}, meta_data, component_to_return=TagPage}) {
        const tag = Tag.get_by_name(tag_name, {can_be_null: true});
        if( ! tag ) {
            const text = <div>
                Catalog <code className="css_da css_inline">{tag_name}</code> not found.
            </div>;
            return <NotFound404Page.component text={text} />;
        }
        this.generate_css({tag});
        timerlog({tags: ['performance', 'performance_props'], id: 'get_props', start_timer: true});
        const props = component_to_return.get_props({tag, meta_data, route_search_query});
        timerlog({id: 'get_props', end_timer: true});
        timerlog({id: 'React.createElement', start_timer: true, measured_time_threshold: 5});
        const el = React.createElement(component_to_return, props)
        timerlog({id: 'React.createElement', end_timer: true});
        return el;
    },
    generate_css: ({tag}) => {
        const color = tag.display_options.tag_color;
        if( typeof window !== "undefined" ) {
            const style_el = window.document.createElement('style');
            style_el.innerHTML = [
                ".css_tag_color__text{color: "+color+"}",
                ".css_tag_color__border{border-color: "+color+"}",
                ".css_tag_color__side_borders{border-left-color: "+color+"; border-right-color: "+color+"}",
                ".css_tag_color__background_color{background-color: "+color+"}",
                ":root { --css_tag_color: "+color+"}",
            ].join('');
            window.document.head.appendChild(style_el)
        }
    },
    get_page_head: function({route: {params: {tag_name}}, is_fetching_data}) {
        const tag = Tag.get_by_name(tag_name, {can_be_null: true});
        if( ! tag ) {
            if( is_fetching_data ) {
                return {
                    title: tag_name+' - loading...',
                    description: 'Loading data for `'+tag_name+'`',
                    hide_sidebar: true,
                };
            } else {
                return NotFound404Page.get_page_head.apply(this, arguments);
            }
        }
        const display_options = tag.display_options;
        assert_soft(display_options.tag_description, tag, tag_name);
        assert_soft(display_options.tag_description__without_number, tag, tag_name);
        return {
            title: display_options.tag_description,
            description: display_options.tag_description__without_number,
        };
    },
};
