import React from 'react';
import assert from 'assert';
import classNames from 'classnames'

import Thing from '../../../thing';
import Resource from '../../../thing/resource';
import pretty_print from '../../../util/pretty_print';
import normalize_url from '../../../util/normalize_url';

import rerender from '../../../rerender';

import UserSnippet from '../../snippets/user';
import CommentListSnippet from '../../snippets/comment-list';
import LoginRequired from '../../snippets/login-required';

import FaCalendarPlusO from 'react-icons/lib/fa/calendar-plus-o';
import FaDownload from 'react-icons/lib/fa/download';
import FaTags from 'react-icons/lib/fa/tags';
import FaChain from 'react-icons/lib/fa/chain';
//import GoLink from 'react-icons/lib/go/link';
import FaPencil from 'react-icons/lib/fa/pencil';
import FaInfo from 'react-icons/lib/fa/info';
import FaCircle from 'react-icons/lib/fa/circle';
import FaCaretUp from 'react-icons/lib/fa/caret-up';
import FaCaretDown from 'react-icons/lib/fa/caret-down';
import GoStar from 'react-icons/lib/go/star';
import GoMarkGithub from 'react-icons/lib/go/mark-github';
import GoGitCommit from 'react-icons/lib/go/git-commit';


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

        const upvotes_text = render_vote_text({is_negative: false, vote_number: upvotes});
        const downvotes_text = render_vote_text({is_negative: true, vote_number: downvotes});

        return (
            <fieldset
              className={classNames({
                "css_saving": saving_vote!==undefined,
                "css_da": true,
              })}
              style={{paddingTop: 6}}
              disabled={disabled}
            >{
                this.props.request_view ?
                    <div>
                        { upvote_btn }{' '}{ downvote_btn }
                    </div> :
                    <div>
                        <div className="css_note">
                            {upvotes_text}
                            {upvotes_text && downvotes_text ? ', ' : null}
                            {downvotes_text}
                        </div>
                        <div style={{marginTop: 3}}>
                            { upvote_btn }{' '}{ downvote_btn }
                        </div>
                    </div>
            }</fieldset>
        );

        function render_vote_text({is_negative, vote_number}) { 
            if( vote_number === 0 ) {
                return null;
            }
            return <span style={{display: 'inline-block', marginBottom: 7}}>
                {vote_number} {is_negative?'down':'up'}vote{vote_number===1?'':'s'}
            </span>;
        } 
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
                        "css_color_contrib_light"
                      )}
                    >
                        <span
                          className={"css_color_contrib_icon"}
                          style={{fontSize: '1.5em', lineHeight: 0}}
                        >
                            { is_negative ? <FaCaretDown /> : <FaCaretUp /> }
                        </span>
                        {' '}
                        { already_voted ? 'un-' : '' }
                        { is_negative ? 'down' : 'up' }
                        vote
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

const IconTextBlock = ({icon, text}) =>
    text &&
        <div style={{whiteSpace: 'nowrap'}}>
            <div style={{verticalAlign: 'top', display: 'inline-block'}}>
                { icon }
            </div>
            <div style={{display: "inline-block", whiteSpace: 'normal'}}>
                { text }
            </div>
        </div>
    ;

const ResourceDetailsSnippet = React.createClass({ 
    render: function(){
        const resource = this.props.resource;

        if( !resource ) return <div>Resource Not Found</div>;

        const no_github_info = Object.keys(resource.github_info||{}).length===0;

        const github_section = (() => { 
            if( no_github_info ) {
                return null;
            }

            const description = (() => {
                const homepage = resource.github_info.homepage;
                const description_text = resource.github_info.description;
                const text = description_text + (!homepage ? '' : ((!description_text?'':' ') + homepage));
                return (
                    <IconTextBlock
                      icon={<FaInfo className="css_up_1px"/>}
                      text={text}
                    />
                );
            })();

            const stars = (() => {
                const stars_number = resource.github_info.stargazers_count;
                return <div>
                    <GoStar className="css_up_1px"/>
                    {pretty_print.points(stars_number)}
                </div>;
            })();

            const link = <div>
                <GoMarkGithub className="css_up_1px"/>
                <a className="css_da" target="_blank" href={resource.github_info.html_url} target="_blank">
                    {'https://github.com/'+resource.github_full_name}
                </a>
            </div>;

            const date_creation = (() => {
                const created_at = resource.github_info.created_at;
                return <div>
                    <FaCalendarPlusO className="css_up_1px"/>
                    Creation date:
                    {' '}
                    {pretty_print.date(created_at)}
                </div>;
            })();

            const date_commit = (() => {
                const pushed_at = resource.github_info.pushed_at;
                    return <div>
                        <GoGitCommit className="css_up_1px"/>
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
            if( ! resource.npm_info ) {
                return null;
            }

            const url = "https://www.npmjs.com/package/"+resource.npm_info.name;
            return [
                <h2 key={1} className="css_da">npm</h2>,
                <div key={2} className="css_resource_details__npm">
                    <div>
                        <FaChain />
                        <a className="css_da" target="_blank" href={url}>{url}</a>
                    </div>
                    <div className="markdown-body" style={{fontSize: 'inherit'}}>
                        <FaDownload />
                        <pre style={{display: 'inline', padding: '3px 7px'}}>
                            npm install {resource.npm_info.name}
                        </pre>
                    </div>
                    <div>
                        <FaInfo className="css_up_1px"/>
                        {resource.npm_info.description}
                    </div>
                </div>
            ];
        })(); 

        const readme_section = (() => { 
            if( no_github_info ) {
                return null;
            }

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
                <code className="css_da css_inline" style={{fontSize: '1em'}}>{resource.resource_name}</code>;

            const disable_new_comment = resource.commentable.comments_all.some(c => c.editing);

            return [
            //  <h2 key={'title'} className="css_da">Community</h2>,
                <VoteSnippet key={'vote'} resource={resource} request_view={this.props.request_view} />,
                <div
                  key={'vote_note'}
                  className="css_p css_note"
                  style={{fontSize: '10px'}}
                >
                    { this.props.is_request ?
                        <div>
                            {resource_quote} will be added to the catalog if it gets upvoted or removed if it gets downvoted.
                        </div> :
                        <div>
                            If {resource_quote} gets downvoted then it will be removed from the catalog.
                        </div>
                    }
                </div>,
                <br key={'br1'}/>,
                <CommentListSnippet.component key={'comments'} thing={resource} disable_new_comment={disable_new_comment} />,
                <LoginRequired.component key={'login'} text={'to vote and review'} />,
                <br key={'br2'}/>,
            ];
        })(); 

        const html_section = (() => { 
            if( ! resource.html_info ) {
                return null;
            }
            assert(resource.resource_url);

            // const title = resource.resource_title;
            const description = resource.html_info.html_description;
            const title = resource.html_info.html_title;
            const resource_url = normalize_url.ensure_protocol_existence(resource.resource_url);
            const resource_url_normalized = resource.resource_url_normalized;

            return [
             // <h2 key={0} className="css_da">Web</h2>,
                <div key={1} className="css_resource_details__web">
                    <div>
                        <FaChain/>
                        <a href={resource_url} target="_blank" className="css_da">{resource_url_normalized}</a>
                    </div>
                    <IconTextBlock
                      icon={<FaCircle className="css_up_1px"/>}
                      text={title}
                    />
                    <IconTextBlock
                      icon={<FaInfo className="css_up_1px"/>}
                      text={description}
                    />
                </div>,
            ];
        })(); 

        return <div className="css_resource_details">
            { community_section }
            { html_section }
            { github_section }
            { npm_section }
            { readme_section }
        </div>;
    },
}); 

let loading_view = false;

export default {
    component: ResourceDetailsSnippet,
    fetch: ({github_full_name, resource_url_normalized}) => {
        loading_view = true;
        return (
            Resource.retrieve_view({github_full_name, resource_url_normalized})
        )
        .then(() => {
            loading_view = false;
        });
    },
};

