import React from 'react';
import assert from 'assert';
import classNames from 'classnames'

import Thing from '../../../thing';
import Resource from '../../../thing/resource';
import pretty_print from '../../../util/pretty_print';

import rerender from '../../../rerender';

import FaCheck from 'react-icons/lib/fa/check';
import FaClose from 'react-icons/lib/fa/close';
import FaPencil from 'react-icons/lib/fa/pencil';
import FaInfo from 'react-icons/lib/fa/info';
import UserSnippet from '../../snippets/user';
import CommentListSnippet from '../../snippets/comment-list';
import LoginRequired from '../../snippets/login-required';


const VoteSnippet = React.createClass({ 
    render: function() {
        const resource = this.props.resource;

        assert(resource.votable);

        const that = this;

        const saving_vote = (that.state||{}).saving_vote;

        const user_is_logged = !!Thing.things.logged_user;

        const disabled = saving_vote!==undefined || !user_is_logged;

        const upvote_btn = render_vote_button({is_negative: false});
        const downvote_btn = render_vote_button({is_negative: true});

        const upvotes = resource.preview.number_of_upvotes||0;
        const downvotes = resource.preview.number_of_downvotes||0;

        return (
            <fieldset
              className={classNames({
                "css_saving": saving_vote!==undefined,
                "css_da": true,
              })}
              style={{paddingTop: 8}}
              disabled={disabled}
            >{
                this.props.request_view ?
                    <div>
                        { upvote_btn }{' '}{ downvote_btn }
                    </div> :
                    <div>
                        <div className="css_note" style={{marginBottom: 7}}>
                            {upvotes} upvote{upvotes===1?'':'s'}, {downvotes} downvote{downvotes===1?'':'s'}
                        </div>
                        <div>
                            { upvote_btn }{' '}{ downvote_btn }
                        </div>
                    </div>
            }</fieldset>
        );

        function render_vote_button({is_negative}) { 
            const already_voted = resource.votable.upvote.user_did({is_negative});

            return (
                <button
                    className={classNames({
                      "css_primary_button": true,
                      "css_dark_bg": true,
                      "css_unpressed_button": !already_voted,
                      "css_async_action_button": saving_vote===is_negative,
                    })}
                    disabled={disabled}
                    onClick={onClick}
                >
                    <span
                      className={classNames(
                    //  "css_color_contrib_light"
                      )}
                    >
                        <i
                          className={"fa fa-caret-"+(is_negative?"down":"up")}
                          style={{fontSize: '1.3em', color: '#afafaf'}}
                        ></i>
                        <span
                          className={classNames(
                            "css_color_contrib_light"
                          )}
                        >
                            {' '}
                            { already_voted ? 'un-' : '' }
                            { is_negative ? 'down' : 'up' }
                            vote
                        </span>
                    </span>
                </button>
            );

            function onClick() {
                that.setState({
                    saving_vote: is_negative,
                });
                resource.votable.upvote.toggle({is_negative})
                .then(() => {
                    that.setState({
                        saving_vote: undefined,
                    });
                    rerender.carry_out();
                })
            }
        } 
    },
}); 

const ResourceDetailsSnippet = React.createClass({ 
    render: function(){
        const resource = this.props.resource;

        if( !resource ) return <div>Resource Not Found</div>;

        const github_section = (() => { 
            const description = (() => {
                const homepage = resource.github_info.homepage;
                const description_text = resource.github_info.description;
                if( ! homepage && ! description_text ) {
                    return null;
                }
                return <div>
                        <i className="octicon octicon-info"/>
                        <span style={{wordBreak: "break-all"}}>
                                { description_text }
                                {' '}
                                { homepage && <a className="css_da" target="_blank" href={homepage}>{homepage}</a> }
                        </span>
                </div>;
            })();

            const stars = (() => {
                const stars_number = resource.github_info.stargazers_count;
                return <div>
                    <i className="octicon octicon-star"/>
                    {pretty_print.points(stars_number)}
                </div>;
            })();

            const link = <div>
                <i className="octicon octicon-mark-github"/>
                <a className="css_da" target="_blank" href={resource.github_info.html_url} target="_blank">
                    {'https://github.com/'+resource.github_full_name}
                </a>
            </div>;

            const date_creation = (() => {
                const created_at = resource.github_info.created_at;
                return <div>
                    <i className="fa fa-calendar-plus-o" />
                    Creation date:
                    {' '}
                    {pretty_print.date(created_at)}
                </div>;
            })();

            const date_commit = (() => {
                const pushed_at = resource.github_info.pushed_at;
                    return <div>
                        <i className="octicon octicon-git-commit" />
                        Last commit:
                        {' '}
                        {pretty_print.date(pushed_at)}
                    </div>
            })();


            return [
                <h2 key={0} className="css_da">GitHub</h2>,
                <div key={1} className="css_resource_details__github">
                    {link}
                    {description}
                    {stars}
                    {date_creation}
                    {date_commit}
                </div>,
            ];
        })(); 

        const npm_section = (() => { 
            if( ! resource.npm_info ) return null;
            const url = "https://www.npmjs.com/package/"+resource.npm_info.name;
            return [
                <h2 key={1} className="css_da">NPM</h2>,
                <div key={2} className="css_resource_details__npm">
                    <div>
                        <i className="fa fa-link" />
                        <a className="css_da" target="_blank" href={url}>{url}</a>
                    </div>
                    <div className="markdown-body" style={{fontSize: 'inherit'}}>
                        <i className="fa fa-download" />
                        <pre style={{display: 'inline', padding: '3px 7px'}}>
                            npm install {resource.npm_info.name}
                        </pre>
                    </div>
                    <div>
                        <i className="fa fa-info" />
                        {resource.npm_info.description}
                    </div>
                    <div>
                        <i className="fa fa-tags" />
                        {(resource.npm_info.keywords||[]).join(', ')||'None'}
                    </div>
                </div>
            ];
        })(); 

        const readme_section = (() => { 
            return [
                <h2 key={0} className="css_da">Readme</h2>,
                <div
                  key={1}
                  className="markdown-body"
                  style={{paddingBottom: 50, paddingLeft: 8, paddingRight: 8}}
                  dangerouslySetInnerHTML={{__html: resource.github_info.readme}}
                />,
            ];
        })(); 

        const community_section = (() => { 
            const resource_quote =
                <code className="css_da css_inline" style={{fontSize: '1em'}}>{resource.npm_package_name}</code>;
            return [
            //  <h2 key={'title'} className="css_da">Community</h2>,
                <VoteSnippet key={'vote'} resource={resource} request_view={this.props.request_view}/>,
                <br key={'br1'}/>,
                <CommentListSnippet.component key={'comments'} thing={resource} />,
                <LoginRequired.component key={'login'} text={'to vote and comment'}/>,
                <br key={'br2'}/>,
                <div
                  key={'vote_note'}
                  className="css_p css_note"
                  style={{fontSize: '10px'}}
                >
                    { this.props.is_request ?
                        <div>
                            After enough upvotes {resource_quote} will be added to the catalog.
                        </div> :
                        <div>
                            If {resource_quote} gets several downvotes then it will be removed from the catalog.
                        </div>
                    }
                </div>,
                <br key={'br3'}/>,
            ];
        })(); 

        return <div className="css_resource_details">
            { community_section }
            { github_section }
            { npm_section }
            { readme_section }
        </div>;
    },
}); 

let loading_view = false;

export default {
    component: ResourceDetailsSnippet,
    fetch: github_full_name => {
        loading_view = true;
        return (
            Resource.retrieve_view(github_full_name)
        )
        .then(() => {
            loading_view = false;
        });
    },
};

