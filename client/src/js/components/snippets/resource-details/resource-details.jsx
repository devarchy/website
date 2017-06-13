import React from 'react';
import assert from 'assertion-soft';
import assert_hard from 'assert';
import assert_soft from 'assertion-soft';
import classNames from 'classnames'
import Promise from 'bluebird';

import Thing from '../../../thing';
import Resource from '../../../thing/resource';
import pretty_print from '../../../util/pretty_print';
import normalize_url from '../../../util/normalize_url';

import rerender from '../../../rerender';
import user_tracker from '../../../user_tracker';

import LoadingSnippet from '../../snippets/loading';
import {LinkMixin, prettify_url} from '../../mixins/link';
import UserSnippet from '../../snippets/user';
import {CommentList, CommentAdder} from '../../snippets/comment-list';
import ReviewPointListSnippet from '../../snippets/reviewpoint-list';
import {default as VoteBlock, VoteButton} from '../../snippets/vote-block';
import LoginRequired from '../../snippets/login-required';
import {TextButtonSnippet, default as ButtonSnippet} from '../../snippets/button';
import MonthPicker from '../../snippets/month-picker';
import {IconHomepage, IconEdit, IconDelete, IconClose, IconUpvote, IconDownvote, IconDesc, IconTitle, IconLink, IconAppeardAt, IconAge} from '../../snippets/icon';
import FaDownload from 'react-icons/lib/fa/download';
import GoStar from 'react-icons/lib/go/star';
import GoMarkGithub from 'react-icons/lib/go/mark-github';
import GoGitCommit from 'react-icons/lib/go/git-commit';
Promise.longStackTraces();


class ModSection extends React.Component { 
    constructor(props){ super(props); this.state = {is_saving: false}; }
    render() {
        return (
            <div
              style={{background: '#eee', marginTop: 40, padding: '20px 10px'}}
            >
                <div>
                    You are a moderator if you see this.
                </div>
                <br />
                <div>
                    <button
                      type="button"
                      className="css_da"
                      disabled={this.state.is_saving}
                      onClick={this.decline_tags.bind(this)}
                    >
                        Move to graveyard/crib
                    </button>
                    {' '}
                    Do that to move the resource to graveyard/crib in all catalogs/categories -- the resource will be visible there.
                </div>
                <br />
                <div>
                    <button
                      type="button"
                      className="css_da"
                      disabled={this.state.is_saving}
                      onClick={this.remove_resource.bind(this)}
                    >
                        Remove resource
                    </button>
                    {' '}
                    Do that to entirely remove the resource -- the resource will not be visible anymore.
                </div>
                { this.state.is_saving && (
                    <LoadingSnippet.component scale={0.6} />
                ) }
            </div>
        );
    }
    decline_tags() {
        const taggedS = (
            Thing.things.all
            .filter(t => t.type==='tagged')
            .filter(t => t.referred_resource === this.props.resource.id)
            .filter(t => {
                const tag = Thing.things.all.find(({id}) => id===t.referred_tag);
                assert_soft(tag);
                // tag is a category
                return !!(tag||{}).referred_tag_markdown_list;
            })
        );
        assert_soft(taggedS.length>0);
        this.remove_things(
            taggedS
            .filter(tagged => {
                assert_soft(tagged.id);
                return tagged.request_approved!==false && tagged.id;
            })
            .map(tagged =>
                new Thing({
                    id: tagged.id,
                    type: tagged.type,
                    draft: {
                        request_approved: false,
                    },
                })
            )
        );
    }
    remove_resource() {
        const thing = this.props.resource;
        assert_soft(thing.id);
        if( ! thing.id ) {
            return;
        }
        assert_soft(thing.github_full_name);
        if( ! thing.github_full_name ) {
            return;
        }
        this.remove_things([new Thing({
            id: thing.id,
            type: thing.type,
            github_full_name: thing.github_full_name,
            draft: {
                is_removed: true,
            },
        })]);
    }
    remove_things(things) {
        if( !things ) {
            return;
        }
        this.setState({is_saving: true});
        Promise.all(
            things
            .map(thing => {
                thing.draft.author = Thing.things.logged_user.id;
                return thing.draft.save();
            })
        )
        .then(() => {
            this.setState({is_saving: false});
            rerender.carry_out();
        });
    }
} 

const IconBlock = ({icon, content, title, className, text_if_none, hide_if_none, little_description, icon_style}) => { 
    if( !content ) {
        return null;
    }
    return (
        <div
          className={className}
          style={{
              whiteSpace: 'nowrap',
          }}
          title={title}
        >
            <span style={Object.assign({
                display: 'inline-block',
                verticalAlign: 'middle',
                fontSize: '1.85em',
                color: '#666',
                position: 'relative',
            }, icon_style)}>
                { icon }
            </span>
            <span style={{
                display: 'inline-block',
                verticalAlign: 'middle',
                whiteSpace: 'normal',
                color: !content && '#aaa',
                paddingLeft: 7,
                paddingTop: 7,
            }}>
                <div
                  style={{
                    fontSize: '1.03em',
                    lineHeight: '1em',
                    padding: '5px 0',
                    margin: '-5px 0',
                    whiteSpace: 'nowrap',
                    maxWidth: 250,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                    { content || text_if_none || 'None' }
                </div>
                <div
                  style={{
                    fontSize: '0.75em',
                    color: '#bbb',
                  }}
                >
                    { little_description }
                </div>
            </span>
        </div>
    );
}; 

const EditableSummary = (() => { 

    const EditButton = props => ( 
        <TextButtonSnippet
          className="css_edit_button"
          icon={<IconEdit style={{color: !!Thing.things.logged_user?'#888':'#ccc'}}/>}
          no_text={true}
          text={'Edit'}
          {...props}
        />
    ); 

    const EditableProp = React.createClass({ 
        render: function() {
            const defaultValue = this.props.currentValue || this.props

            const view = ( ! this.state.edit_mode ? read_view : write_view ).call(this)

            return view;

            function read_view() { 
                const resource = this.props.resource;
                assert(resource);
                const is_logged_in = !!Thing.things.logged_user;
                return (
                    <span>
                        <span
                          style={{
                              color: !this.props.currentValue && '#aaa',
                          }}
                        >
                            <span
                              style={{
                                  marginRight: 10,
                              }}
                            >
                                {this.props.text || this.props.currentValue || this.props.text_if_missing}
                            </span>
                            <EditButton
                              onClick={() => is_logged_in && this.setState({edit_mode: true})}
                            />
                        </span>
                    </span>
                );
            } 

            function write_view() { 
                const resource = this.props.resource;
                assert(resource);
                this.text_draft = this.text_draft || resource[this.props.prop_name] || this.props.currentValue || '';
                return (
                    <div>
                        <form
                          onSubmit={this.save}
                          className={classNames("css_da")}
                        >
                            <span
                              className="css_inline_input"
                              style={{marginRight: 15, marginLeft: -4}}
                            >
                                <input
                                  className="css_da"
                                  autoFocus
                                  defaultValue={this.text_draft}
                                  onChange={ev => {this.text_draft = ev.target.value}}
                                />
                            </span>
                            <TextButtonSnippet
                              css_saving={this.state.is_saving}
                              onClick={this.save}
                              disabled={this.state.is_saving}
                              text={'save'}
                            />
                            <TextButtonSnippet
                              disabled={this.state.is_saving}
                              onClick={() => this.setState({edit_mode: false})}
                              text={'cancel'}
                            />
                        </form>
                        {this.props.write_view_addendum}
                    </div>
                );
            } 
        },
        getInitialState: () => {
            return {
                edit_mode: false,
                is_saving: false,
            };
        },
        save: function(ev) {
            ev.preventDefault();
            assert_hard((Thing.things.logged_user||{}).id);
            const resource = this.props.resource;
            assert(resource);
            for(var i in resource.draft) delete resource.draft[i];
            Object.assign(resource.draft, {
                author: Thing.things.logged_user.id,
                [this.props.prop_name]: this.text_draft,
            });
            resource.draft.save().then(() => {
                rerender.carry_out();
                this.setState({is_saving: false});
                this.setState({edit_mode: false});
            });
            this.setState({is_saving: true});
        },
    }); 

    class CrowdAge extends React.Component { 
        constructor(props) { super(props); this.state = {is_saving: false, is_open: false,} }
        render() {
            const resource = this.props.resource;

            const text = pretty_print.age(resource.published_at, {can_return_null: true, can_be_null, verbose: true, month_approximate: true});

            const is_editing = this.state.is_open===true || this.state.is_saving===true;

            const content = (
                <span>
                    <span
                      style={{
                          color: !text && '#aaa',
                          marginRight: 10,
                      }}>
                        { text ? (text+' old') : 'Unknown age' }
                    </span>
                    { !is_editing &&
                        <EditButton
                          onClick={this.open.bind(this)}
                          disabled={this.state.is_saving}
                        />
                    }
                    { is_editing &&
                        <TextButtonSnippet
                          icon={<IconClose className="css_2px_right"/>}
                          no_text={false}
                          text={'Cancel'}
                          css_saving={this.state.is_saving}
                          disabled={this.state.is_saving}
                          onClick={this.close.bind(this)}
                          style={{marginLeft: 0}}
                        />
                    }
                    <MonthPicker
                      ref="ref_month_picker"
                      onChange={this.onChange.bind(this)}
                      defaultValue={resource.published_at}
                      onClose={this.onClose.bind(this)}
                    />
                </span>
            );

            return (
                <IconBlock
                  className="css_edit_section"
                  icon={<IconAge/>}
                  content={content}
                />
            );
        }

        open() {
            this.setState({is_open: true});
            this.refs["ref_month_picker"].open();
        }
        close() {
            this.refs["ref_month_picker"].close()
        }
        onClose() {
            this.setState({is_open: false});
        }
        onChange(year_month) {
            assert_hard(Thing.things.logged_user);
            assert_hard( year_month===null || (year_month||'').split('-').length===2 && new Date(year_month) != 'Invalid Date' );

            this.setState({is_saving: true});
            const resource = this.props.resource;
            assert_soft(Object.keys(resource.draft).length===0, resource.draft);
            Object.assign(resource.draft, {
                author: Thing.things.logged_user.id,
                crowded__published_at: year_month,
            });
            resource.draft.save()
            .then(() => {
                rerender.carry_out();
                this.setState({is_saving: false});
            });
            this.close();
        }
    }; 

    class ToggleShowInDescription extends React.Component { 
        render() {
            const resource = this.props.resource;
            let desc = resource.resource_desc;
            if( desc.length > 60 ) {
                desc = desc.slice(0,60) + '...';
            }
            return (
                <div style={{marginTop: 5, marginBottom: 12, marginLeft: -3}}>
                    <label className={this.state.is_saving && "css_saving css_is_async css_da"}>
                        <input
                          type="checkbox"
                          checked={resource.show_description}
                          disabled={this.state.is_saving}
                          className="css_da"
                          onChange={ () => {
                              assert_soft(Object.keys(resource.draft).length===0, resource.draft);
                              resource.draft.author = Thing.things.logged_user.id;
                              resource.draft.crowded__show_description = !resource.show_description
                              this.setState({is_saving: true});
                              resource.draft.save()
                              .then(() => {
                                  rerender.carry_out();
                                  this.setState({is_saving: false});
                              })
                          }}
                        />
                        <span disabled={this.state.is_saving}>
                            Show
                            {' '}
                            <code className="css_da css_inline">{desc}</code>
                            {' '}
                            in the one line summary of
                            {' '}
                            <code className="css_da css_inline">{resource.resource_name}</code>
                            {' '}
                            in the list
                        </span>
                    </label>
                </div>
            );
        }
        constructor(props) { super(props); this.state = {is_saving: false}; }
    }; 

    return ({resource}) => {
        if( resource.github_full_name ) {
            return null;
        }
        const resource_url = normalize_url.ensure_protocol_existence(resource.resource_url);
        const resource_url_normalized = resource.resource_url_normalized;

        assert(resource.resource_url, resource);
        return (
            <Section style={{marginBottom: -5, marginTop: 14}}>
                {/*
                <IconBlock
                  icon={<IconLink />}
                  content={
                      <EditableProp
                        text={<LinkMixin url={resource_url} text={resource_url_normalized} give_page_rank={true}/>}
                        prop_name={'resource_url'}
                        resource={resource}
                      />
                  }
                  className="css_edit_section"
                />
                */}
                <IconBlock
                  icon={<IconLink />}
                  content={<LinkMixin url={resource_url} text={resource_url_normalized} give_page_rank={true}/>}
                />
                <IconBlock
                  icon={<IconTitle />}
                  content={
                      <EditableProp
                        prop_name={'crowded__name'}
                        resource={resource}
                        text_if_missing={'No title'}
                        currentValue={resource.resource_name}
                      />
                  }
                  className="css_edit_section"
                />
                <IconBlock
                  icon={<IconDesc />}
                  content={
                      <EditableProp
                        prop_name={'crowded__description'}
                        resource={resource}
                        text_if_missing={'No description'}
                        currentValue={resource.resource_desc}
                        write_view_addendum={<ToggleShowInDescription resource={resource} />}
                      />
                  }
                  className="css_edit_section"
                />
                <CrowdAge resource={resource} />
            </Section>
        );
    };

})(); 

const VoteSnippet = React.createClass({ 
    render: function() {
        const resource = this.props.resource;

        assert(resource.votable);

        const saving_vote = (this.state||{}).saving_vote;

        const user_is_logged = !!Thing.things.logged_user;

        const disabled = saving_vote!==undefined || !user_is_logged;

        return (
            <VoteBlock thing={resource}>
                <VoteButton
                  spec={{
                      is_negative: false,
                      vote_type: 'upvote',
                      text: 'Upvote',
                      icon: <IconUpvote/>,
                  }}
                  desc_text={vote_desc({is_negative: false})}
                  style={{minWidth: 100}}
                />
                <span style={{marginRight: 20}}></span>
                <VoteButton
                  spec={{
                      is_negative: true,
                      vote_type: 'upvote',
                      text: 'Downvote',
                      icon: <IconDownvote/>,
                  }}
                  desc_text={vote_desc({is_negative: true})}
                  style={{minWidth: 100}}
                />
            </VoteBlock>
        );

        function vote_desc({is_negative}) { 
            const number_of_votes = resource.votable.upvote.number_of({is_negative});
            return (
                number_of_votes+' '+(is_negative?'down':'up')+'vote'+(number_of_votes===1?'':'s')
            );
        } 
    },
}); 

const SectionTitle = ({title, desc}) => ( 
    null/*
    <div className="css_section_title">
        <h2 className="css_da">{title}</h2>
        { desc && <em style={{fontSize: '0.85em', display: 'block'}}>{desc}</em> }
    </div>
    */
); 

const Section = props => ( 
    <div {...props}/>
    /*
    <div
      className="css_resource_details_section" {...props}
    />
    */
); 


const ResourceDetailsSnippet = React.createClass({ 
    render: function(){
        const resource = this.props.resource;

        if( !resource ) return <div>Resource Not Found</div>;

        const no_github_info = !resource.github_full_name;

        const SPACE_BETWEEN_LINES = 15;

        let repo_url;
        if( !no_github_info ) {
            repo_url = assert_soft((resource.github_info||{}).html_url, resource) || 'https://github.com/'+resource.github_full_name;
            assert_soft((repo_url||0).constructor===String && repo_url.startsWith('https://github.com/'));
        }

        const info_section = (() => { 
            if( no_github_info ) {
                return null;
            }

            const repo_url__contributors = repo_url+'/graphs/contributors';

            const has_homepage = !!resource.github_info.homepage;
            const homepage = (() => { 
                let url = resource.github_info.homepage;

                // GitHub doesn't seem to normalize URLs
                if( url && ! url.startsWith('http') ) {
                    assert_soft(/^[a-zA-Z]/.test(url), url);
                    url = 'http://'+url;
                }

                return (
                    has_homepage && (
                        <LinkMixin url={url} track_info={{action: 'Library Homepage (set in Github)'}} give_page_rank={true}>
                            <IconBlock
                              icon={<IconHomepage />}
                              content={prettify_url(url)}
                              little_description={"Homepage"}
                              icon_style={{top: 1}}
                            />
                        </LinkMixin>
                    )
                );
            })(); 

            const stars = (() => { 
                const stars_number = resource.github_info.stargazers_count;
                const url = repo_url+'/stargazers';
                return (
                    <LinkMixin
                      url={url}
                      track_info={{action: 'GitHub stargazers page'}}
                    >
                        <IconBlock
                            icon={<GoStar className="css_1px_up"/>}
                            content={pretty_print.points(stars_number)}
                            little_description={'GitHub stars'}
                        />
                    </LinkMixin>
                );
            })(); 

            const github_repo = (() => { 
                const content = repo_url.replace('https://github.com/', '');
                return (
                    <LinkMixin url={repo_url} track_info={{action: 'Library GitHub Page'}} give_page_rank={!has_homepage}>
                        <IconBlock
                            icon={<GoMarkGithub className="css_1px_up"/>}
                            content={content}
                            little_description={"GitHub repository"}
                        />
                    </LinkMixin>
                );
            })(); 

            const date_creation = (() => { 
                const created_at = resource.github_info.created_at;
                return (
                    <LinkMixin
                      url={repo_url__contributors}
                      track_info={{action: 'GitHub contributors page (age section)'}}
                    >
                        <IconBlock
                            icon={<IconAge />}
                            content={pretty_print.age(created_at)}
                            little_description={pretty_print.age(created_at, {verbose: true})+' old'}
                            icon_style={{
                              paddingRight: 2,
                              fontSize: '1.7em',
                            }}
                        />
                    </LinkMixin>
                );
            })(); 

            const date_commit = (() => { 
                const pushed_at = resource.github_info.pushed_at;
                return (
                    <LinkMixin
                      url={repo_url__contributors}
                      track_info={{action: 'GitHub contributors page (last commit section)'}}
                    >
                        <IconBlock
                          icon={<GoGitCommit className="css_1px_up"/>}
                          content={pretty_print.age(pushed_at)}
                          little_description={'Last commit '+pretty_print.age(pushed_at, {verbose: true})+' ago'}
                          icon_style={{top: 2}}
                        />
                    </LinkMixin>
                );
            })(); 

            return (
                <div
                  style={{
                      marginBottom: SPACE_BETWEEN_LINES,
                      display: 'flex',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      maxWidth: 1200,
                  }}
                >
                    {date_creation}
                    {stars}
                    {date_commit}
                    {homepage && <div style={{width: '100%'}}/>}
                    {homepage}
                    {github_repo}
                    {homepage && <div/>}
                </div>
            );
        })(); 

        const npm_section = (() => { 
            if( ! resource.npm_info ) {
                return null;
            }

            const url = "https://www.npmjs.com/package/"+resource.npm_info.name;
            return (
                <Section>
                    <SectionTitle title={'npm'} />
                    <div>
                        <IconBlock
                            icon={<IconLink />}
                            content={<LinkMixin url={url} track_info={{action: 'Library npm package page'}} />}
                        />
                        <IconBlock
                            icon={<FaDownload />}
                            content={
                                <code className="css_da" style={{display: 'inline', padding: '3px 7px'}}>
                                    npm install {resource.npm_info.name}
                                </code>
                            }
                        />
                        <IconBlock
                            icon={<IconDesc />}
                            content={resource.npm_info.description}
                            text_if_none={'No description'}
                        />
                    </div>
                </Section>
            );
        })(); 

        const readme_section = (() => { 
            if( no_github_info ) {
                return null;
            }

            return (
                <div
                  onClick={() => {
                      user_tracker.log_event({
                          category: 'Click somewhere in library readme',
                          action: resource.github_full_name,
                      });
                  }}
                  style={{marginTop: 15}}
                >
                    <div
                      className="markdown-body"
                      dangerouslySetInnerHTML={{__html: resource.github_info.readme}}
                      ref={dom_el => { fix_anchors(dom_el, repo_url); }}
                    />
                </div>
            );
        })(); 

        const contrib_section = (() => { 
            const has_comments = resource.commentable.comments.length>0;
            return (
                <div
                  style={{marginBottom: SPACE_BETWEEN_LINES}}
                >
                    <VoteSnippet resource={resource} request_view={this.props.request_view} />
                    <CommentAdder thing={resource} style={{marginLeft: 20}}/>
                    <LoginRequired.component
                      style={{marginLeft: 20}}
                      text={'to vote & comment'}
                    />
                    { has_comments && <CommentList thing={resource} style={{margin: '10px 0'}}/> }
                </div>
            );
            /*
            const resource_quote =
                <code className="css_da css_inline" style={{fontSize: '1em'}}>{resource.resource_name}</code>;

                <div
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
                </div>
            */
        })(); 

        /*
        const review_section = (() => { 
            if( resource.github_full_name ) {
                return null;
            }
            return (
                <Section>
                    <SectionTitle title={'Pros & Cons'} />
                    <ReviewPointListSnippet.component resource={resource} />
                    <LoginRequired.component text={'to review'} />
                </Section>
            );
        })(); 
        */

        const mod_section = (() => {
            if( ! Thing.things.logged_user ) {
                return null;
            }
            const is_mod = ['brillout', ].includes(Thing.things.logged_user.github_login);
            if( ! is_mod ) {
                return null;
            }
            return (
                <ModSection resource={resource}/>
            );
        })();

        return (
            <div className="css_resource_details" style={this.props.style}>
                { info_section }
                { contrib_section }
                { /*
                <EditableSummary resource={resource} />
                { review_section }
                { npm_section }
                */ }
                { readme_section }
                { mod_section }
            </div>
        );
    },
}); 

export default {
    component: ResourceDetailsSnippet,
    fetch: args => Resource.retrieve_view(args),
};


function fix_anchors(dom_el, repo_url) {
    if( ! dom_el ) {
        return;
    }
    const links = Array.from(dom_el.querySelectorAll("a[href^='"+repo_url+"']"));
    const couples = [];
    links
    .filter(link => !looks_like_an_anchor(link))
    .forEach(link => {
        if( looks_like_an_anchor(link) ) {
            return;
        }
        const url = link.getAttribute('href');
        const targets = (
            links
            .filter(looks_like_an_anchor)
            .filter(l => l.getAttribute('href')===url)
        );
        const target = targets[0];
        if( ! target ) {
            return;
        }
        couples.push({link, target});
    });

    couples.forEach(({link, target}) => {
        link.addEventListener('click', ev => {
            target.scrollIntoView({behavior: 'smooth'});
            ev.preventDefault();
        });
    });

    return;

    function looks_like_an_anchor(el) {
        return (
            el.getAttribute('class')==='anchor' ||
            (el.getAttribute('id')||'').startsWith('user-content')
        );
    }
}
