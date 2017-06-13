import React from 'react';
import assert from 'assertion-soft';
import assert_soft from 'assertion-soft';
import classNames from 'classnames';

import pretty_print from '../../../util/pretty_print';

import Resource from '../../../thing/resource';
import Tag from '../../../thing/tag';

import TagPage from '../../pages/tag';
import TagResourcePage from '../../pages/tag-resource';
import NeedsAndLibsPage from '../../pages/needs-and-libs';

import LinkMixin from '../../mixins/link';

import ResourceViewSnippet from '../../snippets/resource-view';

import user_tracker from '../../../user_tracker';
import text_search from '../../../util/text_search';


const UpvoteHeader = props => { 
    const {
        resource_name,
        resource_desc_line,
        upvotes,
        downvotes,
    } = props;

    const div_name =
        <div
          className={"css_resource_header__name"}
        >
            { resource_name }
        </div>;

    const div_desc =
        <div
          className={"css_resource_header__description"}
        >
            { resource_desc_line }
        </div>;

    const div_votes =
        downvotes*2.5 > (Math.max(upvotes-1,0)) || upvotes<=1 && downvotes>1 ?
            <div className="css_resource_header__downvotes">{downvotes}</div> :
            <div className="css_resource_header__upvotes">{upvotes}</div> ;

    return {
        children: [
            div_votes,
            div_name,
            div_desc,
        ],
    };
}; 

const GitHubInfoHeader = props => { 
    const {
        resource_name,
        resource_desc_line,
        date_column_first,
        created_at,
        stars,
        full_text_search_value,
        need__missing_words,
    } = props;

    const is_a_match = (
        full_text_search_value && (
            text_search.get_missing_words({full_text_search_value, texts: [resource_name, resource_desc_line], per_text: false})
            .every(missing_word => !need__missing_words.includes(missing_word))
        )
    );

    const res_name = !is_a_match ? resource_name : text_search.highlight_search_match(resource_name, full_text_search_value);
    const div_name =
        <div
          className={"css_resource_header__name"}
        >
            { res_name }
        </div>;

    const res_desc = !is_a_match ? resource_desc_line : text_search.highlight_search_match(resource_desc_line, full_text_search_value);
    const div_desc =
        <div
          className={"css_resource_header__description"}
        >
            { res_desc }
        </div>;

    const div_stars =
        <div
          className="css_resource_header__stars"
        >
                { stars }
        </div>;

    const div_date =
        <div
          className="css_resource_header__date"
        >
            { created_at }
        </div>;

    const div_first = date_column_first ? div_date : div_stars;
    const div_second = date_column_first ? div_stars : div_date;

    return {
        is_a_match,
        children: [
            div_first,
            div_second,
            div_name,
            div_desc,
        ],
    };
}; 

const RequestHeader = props => { 
    const {
        resource_name,
        resource_desc_line,
        upvotes,
        downvotes,
        comments,
        request_age,
        category_display_name,
    } = props;

    const div_name =
        <div
          className={"css_resource_header__request_name"}
        >
            { resource_name }
        </div>;

    const div_desc =
        <div
          className={"css_resource_header__request_description"}
        >
            { resource_desc_line }
        </div>;

    const div_request_line =
        <div className="css_description_line">
            {
                [
                    upvotes.toString()+' upvote'+(upvotes===1?'':'s'),
                    downvotes!==0 && (downvotes.toString()+' downvote'+(downvotes===1?'':'s')),
                    typeof window !== "undefined" && (request_age+' ago'),
                    category_display_name && ('in `'+category_display_name+'`'),
                    comments && (comments+' comment'+(comments===1?'':'s')),
                ].filter(Boolean).join(', ')
            }
        </div>;

    return {
        children: [
            div_desc,
            div_name,
            div_request_line,
        ],
    };
}; 

const ResourceLineSnippet = props => { 

        const {children, is_a_match} = (() => {
            if( props.request_view ) {
                return RequestHeader(props);
            }
            if( props.stars ) {
                return GitHubInfoHeader(props);
            }
            return UpvoteHeader(props);
        })();

        const link_url = (() => {
            if( props.resource_tag_name ) {
                return (
                    TagPage.page_route_spec.interpolate_path({tag_name: props.resource_tag_name})
                );
            }
            const tag_name = props.tag_name;
            assert_soft(tag_name);
            const resource_human_id = props.resource_human_id;
            assert_soft(resource_human_id);
            if( props.is_need_view ) {
                return (
                    NeedsAndLibsPage.page_route_spec.interpolate_path({
                        tag_name,
                        search__type: 'LIBRARY_SEARCH',
                        search__value: resource_human_id,
                    })
                );
            }
            return (
                TagResourcePage.page_route_spec.interpolate_path({
                    tag_name,
                    resource_human_id,
                })
            );
        })();

        return (
            <LinkMixin
              to={link_url}
              dont_give_page_rank={true}
              onClick={ev => toggleExpand(ev, props)}
              className={classNames(
                  "css_da css_resource",
                  props.request_view && 'css_resource_request',
                  props.full_text_search_value && !is_a_match && 'css_resource_dim',
              )}
            >
              { children[0] }
              { children[1] }
              { children[2] }
              { children[3] }
            </LinkMixin>
        );
}; 

function toggleExpand(ev, props) { 
    if( props.resource_tag_name ) {
        return;
    }
    if( ev.modifiers.length > 0 ) {
        return;
    }
    ev.preventDefault();

    const is_closing = ResourceViewSnippet.toggle_resource({
        resource_id: props.resource_id,
        tag_name: props.tag_name,
        is_request: props.is_request,
        request_view: props.request_view,
        click_event: ev.event__original,
    });

    if( assert_soft([true, false].includes(is_closing)) ) {
        let category = (is_closing?'collapse':'expand')+' resource line';
     // let category = (is_closing?'open':'close')+' resource view';
        if( props.request_view ) {
            category += ' [new_requests_view]';
        }
        user_tracker.log_event({
            category,
            action: props.resource_name,
        });

        if( is_closing === false ) {
            user_tracker.trackers.track_resource_view({viewed_in: 'resource_view_sidebar'});
        }
    }
} 


export default {
    component: ResourceLineSnippet,
    get_props: ({tag, resource, date_column_first, addition_request_view, category_display_name, req_date, is_request, is_need_view}) => {
        assert_soft([true, false].includes(is_need_view));
        let created_at,
            stars,
            upvotes,
            downvotes,
            comments,
            request_age;

        if( addition_request_view || (resource.github_info||{}).stars===undefined ) {
            upvotes = resource.preview.number_of_upvotes||0;
            downvotes = resource.preview.number_of_downvotes||0;
        }
        if( addition_request_view ) {
            comments = resource.preview.number_of_comments || null;
            request_age = pretty_print.age(req_date, {verbose: true});
        } else {
            created_at = pretty_print.age((resource.github_info||{}).created_at||null, {can_be_null: true});
            /*
            if( ['m', 'y'].includes(created_at.slice(-1)[0]) ) {
                created_at += 'o';
            }
            */
            assert_soft(created_at && created_at!=='?' || !resource.github_full_name, resource);
            const stars_count = (resource.github_info||{}).stargazers_count;
            stars = pretty_print.points((stars_count || stars_count===0)?stars_count:null, {can_be_null: true});
            assert_soft(stars && stars!=='?' || !resource.github_full_name, resource);
        }
        const {resource_human_id, resource_name, resource_desc_line} = resource;
        const resource_tag_name = resource.resource_is_list && resource.preview_tag.name;
        const resource_id = resource.id;
        const tag_name = tag.name;

        return {
            resource_tag_name,
            tag_name,
            resource_human_id,
            resource_id,
            resource_name,
            resource_desc_line,
            date_column_first,
            created_at,
            stars,
            upvotes,
            downvotes,
            comments,
            request_age,
            category_display_name,
            request_view: !!addition_request_view,
            is_request,
            is_need_view,
        };
    },
};
