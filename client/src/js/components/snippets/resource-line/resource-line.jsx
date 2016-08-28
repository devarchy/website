import React from 'react';
import assert from 'assert';
//import shallowCompare from 'react-addons-shallow-compare';

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
                        <ResourceDetailsSnippet.component resource={Resource.get_by_github_full_name(this.props.github_full_name)} />
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

const ResourceLineSnippet = React.createClass({ 
    shouldComponentUpdate: function(nextProps, nextState) {
        return true;
     // return shallowCompare(this, nextProps, nextState);
    },
    getInitialState: () => ({expand: false}),
    toggleExpand: function(ev) {
        this.setState({expand: !this.state.expand})
    },
    onResourceDetailsClick: function(ev) {
        ev.stopPropagation();
    },
    render: function() {

        const {date_column_first, github_full_name, name, description, stars, created_at} = this.props;

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

        const div_name =
            <div
              className="css_resource_header__name"
            >
                { name }
            </div>;

        const div_description =
            <div
              className="css_resource_header__description"
            >
                { description }
            </div>;

        const div_first = date_column_first ? div_date : div_stars;
        const div_second = date_column_first ? div_stars : div_date;

        return (
            <div
              onClick={this.toggleExpand}
              className="css_resource_header"
            >
              { div_first }
              { div_second }
              { div_name }
              { div_description }
              <ResourceDetailsLoadingWrapper
                github_full_name={github_full_name}
                expand={this.state.expand}
                onClick={this.onResourceDetailsClick}
              />
            </div>
        );
    },
}); 


export default {
    component: ResourceLineSnippet,
    get_props: ({resource, date_column_first}) => {
        assert( resource.constructor === Resource);
        assert( [true, false, undefined].includes(date_column_first) );

        const {github_full_name, description} = resource;
        const created_at = pretty_print.date(resource.github_info.created_at);
        const stars = pretty_print.points(resource.github_info.stargazers_count);
        const name = (resource.npm_info||{}).name || resource.npm_package_name || resource.github_full_name;

        return {
            date_column_first,
            github_full_name,
            description,
            name,
            stars,
            created_at,
        };
    },
};
