import React from 'react';
import assert from 'assert';

import pretty_print from '../../../util/pretty_print';

import Resource from '../../../thing/resource';

//import CollapseMixin from '../../mixins/collapse';

import ResourceDetailsSnippet from '../../snippets/resource-details';
import LoadingSnippet from '../../snippets/loading';


const ResourceDetailsLoadingWrapper = React.createClass({ 
    propTypes: {
        github_full_name: React.PropTypes.string.isRequired,
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

        const content = (() => {
            if( ! props.expand ) {
                return null;
            }
            return (
                <div
                  onClick={this.props.onClick}
                  className="css_resource_body"
                >{
                    this.state.loading ?
                        <div className="css_resource_details__loading"><LoadingSnippet.component /></div> :
                        <ResourceDetailsSnippet.component
                          resource={Resource.get_by_github_full_name(this.props.github_full_name)}
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
        ResourceDetailsSnippet.fetch(this.props.github_full_name)
        .then(() => {
            if( this.isMounted() ) {
                this.setState({loading: false});
            }
        });
    },
}); 

const Header = props => { 
    const {
        date_column_first,
        npm_package_name,
        description,
        stars,
        created_at,
    } = props;

    const div_name =
        <div
          className={"css_resource_header__name"}
        >
            { npm_package_name }
        </div>;

    const div_description =
        <div
          className={"css_resource_header__description"}
        >
            { description }
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
        npm_package_name,
        description,
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
            (
            { npm_package_name }
            )
        </div>;

    const div_description =
        <div
          className={"css_resource_header__request_description"}
        >
            { description }
        </div>;

    const div_request_line =
        <div className="css_description_line">
            { upvotes.toString() }
            {' upvote'+(upvotes===1?'':'s')+', '}
            { downvotes===0 ? '' : (downvotes.toString()+' downvote'+(downvotes===1?'':'s')+', ') }
            { request_age }
            { ' ago,'}
            {' in `'}
            { category }
            { '`' }
            { comments && (
                ', '+ comments + ' comment'+(comments===1?'':'s')
            ) }
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

        const header = this.props.request_view ? RequestHeader(this.props) : Header(this.props);

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
    get_props: ({resource, date_column_first, addition_request_view, is_request}) => {
        assert( resource.constructor === Resource);
        assert( [true, false, undefined].includes(date_column_first) );

        let created_at,
            stars,
            upvotes,
            downvotes,
            comments,
            request_age,
            category;

        if( addition_request_view ) {
            upvotes = resource.preview.number_of_upvotes||0;
            downvotes = resource.preview.number_of_downvotes||0;
            comments = resource.preview.number_of_comments || null;
            request_age = pretty_print.age(resource.created_at, {verbose: true});
            category = addition_request_view;
        } else {
            created_at = pretty_print.date(resource.github_info.created_at);
            stars = pretty_print.points(resource.github_info.stargazers_count);
        }
        const {description, github_full_name, npm_package_name} = resource;

        return {
            date_column_first,
            github_full_name,
            description,
            npm_package_name,
            stars,
            created_at,
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
