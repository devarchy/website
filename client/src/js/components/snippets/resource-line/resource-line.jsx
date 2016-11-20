import React from 'react';
import assert from 'assert';

import pretty_print from '../../../util/pretty_print';

import Resource from '../../../thing/resource';

//import CollapseMixin from '../../mixins/collapse';

import ResourceDetailsSnippet from '../../snippets/resource-details';
import LoadingSnippet from '../../snippets/loading';


const ResourceDetailsLoadingWrapper = React.createClass({ 
    propTypes: {
        github_full_name: React.PropTypes.string,
        resource_url_normalized: React.PropTypes.string,
        expand: React.PropTypes.bool.isRequired,
    },
    componentWillReceiveProps: function(nextProps) {
        if( nextProps.expand === true && this.props.expand === false ) {
            this._fetch();
            this.setState({loading: true});
        }
    },
    getInitialState: function() {
        return {loading: false};
    },
    render: function() {

        const props = this.props;

        assert(props.github_full_name || props.resource_url_normalized);

        const content = (() => {
            if( ! props.expand ) {
                return null;
            }

            const resource =
                this.props.github_full_name ?
                    Resource.get_by_github_full_name(this.props.github_full_name) :
                    Resource.get_by_resource_url_normalized(this.props.resource_url_normalized) ;

            return (
                <div
                  onClick={this.props.onClick}
                  className="css_resource_body"
                >{
                    this.state.loading ?
                        <div className="css_resource_details__loading"><LoadingSnippet.component /></div> :
                        <ResourceDetailsSnippet.component
                          resource={resource}
                          is_request={this.props.is_request}
                          request_view={this.props.request_view}
                        />
                }</div>
            );
        })();

        return content;
     // return <CollapseMixin.component isOpened={!!props.expand}>{content}</CollapseMixin.component>

    },
    _fetch: function() {
        ResourceDetailsSnippet.fetch({
            github_full_name: this.props.github_full_name,
            resource_url_normalized: this.props.resource_url_normalized,
        })
        .then(() => {
            if( this.isMounted() ) {
                this.setState({loading: false});
            }
        });
    },
}); 

const UpvoteHeader = props => { 
    const {
        resource_name,
        resource_desc,
        upvotes,
        downvotes,
    } = props;

    const div_name =
        <div
          className={"css_resource_header__name"}
        >
            { resource_name }
        </div>;

    const div_description =
        <div
          className={"css_resource_header__description"}
        >
            { resource_desc }
        </div>;

    const div_votes =
        downvotes*2.5 > (Math.max(upvotes-1,0)) || upvotes<=1 && downvotes>1 ?
            <div className="css_resource_header__downvotes">{downvotes}</div> :
            <div className="css_resource_header__upvotes">{upvotes}</div> ;

    return [
        div_votes,
        div_name,
        div_description,
    ]
}; 

const GitHubInfoHeader = props => { 
    const {
        resource_name,
        resource_desc,
        date_column_first,
        created_at,
        stars,
    } = props;

    const div_name =
        <div
          className={"css_resource_header__name"}
        >
            { resource_name }
        </div>;

    const div_description =
        <div
          className={"css_resource_header__description"}
        >
            { resource_desc }
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

    return [
        div_first,
        div_second,
        div_name,
        div_description,
    ]
}; 

const RequestHeader = props => { 
    const {
        resource_name,
        resource_desc,
        upvotes,
        downvotes,
        comments,
        request_age,
        category,
    } = props;

    const div_name =
        <div
          className={"css_resource_header__request_name"}
        >
            { resource_name }
        </div>;

    const div_description =
        <div
          className={"css_resource_header__request_description"}
        >
            { resource_desc }
        </div>;

    const div_request_line =
        <div className="css_description_line">
            { upvotes.toString()+' upvote'+(upvotes===1?'':'s')+', ' }
            { downvotes===0 ? '' : (downvotes.toString()+' downvote'+(downvotes===1?'':'s')+', ') }
            { request_age+' ago' }
            { category && (', in `'+category+'`') }
            { comments && (', '+comments+' comment'+(comments===1?'':'s')) }
        </div>;

    return [
        div_description,
        div_name,
        div_request_line,
    ];
}; 

const ResourceLineSnippet = React.createClass({ 
    getInitialState: () => ({expand: false}),
    toggleExpand: function(ev) {
        this.setState({expand: !this.state.expand})
    },
    onResourceDetailsClick: function(ev) {
        ev.stopPropagation();
    },
    render: function() {

        const header = (() => {
            if( this.props.request_view ) {
                return RequestHeader(this.props);
            }
            if( this.props.stars ) {
                return GitHubInfoHeader(this.props);
            }
            return UpvoteHeader(this.props);
        })();

        return (
            <div
              onClick={this.toggleExpand}
              className={"css_resource"+(this.props.request_view?' css_resource_request':'')}
            >
              { header[0] }
              { header[1] }
              { header[2] }
              { header[3] }
              <ResourceDetailsLoadingWrapper
                github_full_name={this.props.github_full_name}
                resource_url_normalized={this.props.resource_url_normalized}
                expand={this.state.expand}
                is_request={this.props.is_request}
                request_view={this.props.request_view}
                onClick={this.onResourceDetailsClick}
              />
            </div>
        );
    },
}); 


export default {
    component: ResourceLineSnippet,
    get_props: ({resource, date_column_first, addition_request_view, category, is_request}) => {
        assert( resource.constructor === Resource);
        assert( [true, false, undefined].includes(date_column_first) );

        let created_at,
            stars,
            upvotes,
            downvotes,
            comments,
            request_age;

        if( addition_request_view || !(resource.github_info||{}).stars ) {
            upvotes = resource.preview.number_of_upvotes||0;
            downvotes = resource.preview.number_of_downvotes||0;
        }
        if( addition_request_view ) {
            comments = resource.preview.number_of_comments || null;
            request_age = pretty_print.age(resource.created_at, {verbose: true});
        } else {
            created_at = pretty_print.date((resource.github_info||{}).created_at, {can_return_null: true});
            stars = pretty_print.points((resource.github_info||{}).stargazers_count, {can_return_null: true});
        }
        const {resource_name, resource_desc} = resource;
        const {github_full_name, resource_url_normalized} = resource;

        return {
            github_full_name,
            resource_url_normalized,
            resource_name,
            resource_desc,
            date_column_first,
            created_at,
            stars,
            upvotes,
            downvotes,
            comments,
            request_age,
            category,
            request_view: !!addition_request_view,
            is_request,
        };
    },
};
