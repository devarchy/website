import React from 'react';
import assert from 'assert';
import classNames from 'classnames'

import Resource from '../../../thing/resource';
import pretty_print from '../../../util/pretty_print';

import rerender from '../../../rerender';

import FaCheck from 'react-icons/lib/fa/check';
import FaClose from 'react-icons/lib/fa/close';
import FaPencil from 'react-icons/lib/fa/pencil';
import UserSnippet from '../../snippets/user';


const TaggedReviewsSnippet = ({resource}) => { 
    const taggedreviews = resource.taggedreviews;
    return (
        <div>{
            taggedreviews.map(({tag, tagged, reviews, category_tag}) =>
                <TaggedReviewSnippet
                  key={tag.key}
                  resource={resource}
                  tag={tag}
                  tagged={tagged}
                  reviews={reviews}
                  category_tag={category_tag}
                />)
        }</div>
    );
}; 

const TaggedReviewSnippet = React.createClass({ 
    propTypes: {
        resource: React.PropTypes.object.isRequired,
        tag: React.PropTypes.object.isRequired,
        category_tag: React.PropTypes.object.isRequired,
        reviews: React.PropTypes.array.isRequired,
    },
    getInitialState: function(){
        const user_review = Thing.things.logged_user && this.props.reviews.filter(t => t.author === Thing.things.logged_user.id)[0];
        return {
            edit_mode: false,
            saving: false,
            form__is_rejection: user_review ? !!user_review.rejection_argument : null,
            form__rejection_argument: (user_review||{}).rejection_argument || '',
            validation__rejection_argument_is_missing: false,
            validation__radio_is_missing: false,
        };
    },
    toggle_edit_mode: function() {
        event.preventDefault();
        this.setState({edit_mode: !this.state.edit_mode});
    },
    handle_rejection_argument_change: function(event) {
        const val = event.target.value;
        this.setState({form__rejection_argument: val, validation__rejection_argument_is_missing: false});
    },
    handle_radio_change: function(event){
        const val = event.target.value;
        assert(["no", "yes"].includes(val));
        this.setState({form__is_rejection: val==="yes"? true : false, validation__radio_is_missing: false});
    },
    submit_review: function(event){
        event.preventDefault();
        assert(this.props.resource.id);
        assert(Thing.things.logged_user);
        assert(Thing.things.logged_user.id);
        const new_state = {
            validation__rejection_argument_is_missing: this.state.form__is_rejection && this.state.form__rejection_argument.length === 0,
            validation__radio_is_missing: this.state.form__is_rejection === null,
        };
        if( new_state.validation__rejection_argument_is_missing || new_state.validation__radio_is_missing ) {
            this.setState(new_state);
            return;
        }
        this.setState(Object.assign(new_state, {saving: true}));
        const rejection_argument = this.state.form__is_rejection ? this.state.form__rejection_argument : null;
        new Thing({
            type: 'taggedreview',
            referred_tagged: this.props.tagged.id,
            author: Thing.things.logged_user.id,
            rejection_argument,
            draft: {},
        }).draft.save()
        .then(([request_review]) => {
            assert(
                !request_review.rejection_argument && !rejection_argument ||
                request_review.rejection_argument === rejection_argument );
            assert( this.props.resource.taggedreviews.filter(tagreq => tagreq.tagged.id === this.props.tagged.id && tagreq.rejection_argument === rejection_argument) );
            rerender.carry_out();
            if( ! this.isMounted() ) return;
            this.setState({saving: false, edit_mode: false});
        });
    },
    render: function(){
        const taggedreviews = this.props.reviews;
        const user_review = Thing.things.logged_user && taggedreviews.filter(t => t.author === Thing.things.logged_user.id)[0] || null;
        const edit_view = this.state.edit_mode || ! user_review;
        const resource = this.props.resource;
        const tag__category = this.props.category_tag;
        assert( tag__category.display_title );
        return <div>
            Should <code className="css_da css_inline">{resource.npm_package_name}</code> be included to
            {' '}
            <code className="css_da css_inline">{
                tag__category
                .ancestor_tags
                .reverse()
                .concat(tag__category)
                .map(ancestor => ancestor.display_title)
                .join(' > ')
            }</code>
            {' '}
            ?
            {
                edit_view ? (
                    <form className={classNames({css_saving: this.state.saving})} onSubmit={this.submit_review}>
                        <fieldset className="css_da" disabled={!Thing.things.logged_user || this.state.saving}>
                            <div style={{padding: '12px 0'}}>
                                <label>
                                    <input
                                      type="radio"
                                      name="rejection"
                                      value="no"
                                      defaultChecked={this.state.form__is_rejection===false}
                                      onChange={this.handle_radio_change}
                                      style={{verticalAlign: 'middle'}}
                                    />
                                    <FaCheck className="css_color_green" />
                                    {' '}
                                    <span style={{verticalAlign: 'middle'}}>Yes</span>
                                </label>
                                <label
                                  style={{display: 'inline-block', marginLeft: 31}}
                                >
                                    <input
                                      type="radio"
                                      name="rejection"
                                      value="yes"
                                      defaultChecked={this.state.form__is_rejection===true}
                                      onChange={this.handle_radio_change}
                                      style={{verticalAlign: 'middle'}}
                                    />
                                    <FaClose className="css_color_red" />
                                    {' '}
                                    <span style={{verticalAlign: 'middle'}}>No</span>
                                </label>
                                {
                                    this.state.validation__radio_is_missing &&
                                        <div className="css_color_red" style={{marginTop: 10}}>
                                            Select whether {resource.npm_package_name} should be included or not
                                        </div>
                                }
                                {
                                    this.state.form__is_rejection && (
                                        <div>
                                            <label>
                                                <div className="css_description_label">
                                                    This library should not be included because:
                                                    {
                                                        this.state.validation__rejection_argument_is_missing &&
                                                            <span className="css_color_red">
                                                                {' '}is required
                                                            </span>
                                                    }
                                                </div>
                                                <textarea
                                                  autoFocus
                                                  cols="50"
                                                  rows="3"
                                                  onChange={this.handle_rejection_argument_change}
                                                  defaultValue={this.state.form__rejection_argument}
                                                />
                                            </label>
                                        </div>
                                    )
                                }
                            </div>
                            <div>
                                <button type="submit" className="css_da css_primary">
                                    <span className="css_color_contrib css_da">Submit review</span>
                                </button>
                                {
                                    this.state.edit_mode &&
                                        <button
                                          className="css_da css_secondary css_sidebutton"
                                          type="button"
                                          onClick={this.toggle_edit_mode}
                                          style={{marginLeft: 20, fontSize: '1em'}}
                                        >
                                            <FaClose />
                                            <span style={{verticalAlign: 'middle'}}>{' '}Cancel</span>
                                        </button>
                                }
                            </div>
                        </fieldset>
                        {
                            ! Thing.things.logged_user &&
                                <div className="css_color_red" style={{marginTop: 10}}>
                                    Log in required to review
                                    <br/>
                                    <a
                                      style={{textDecoration: 'underline'}}
                                      href="/auth/github"
                                    >
                                        <span
                                          className="css_color_contrib"
                                          style={{textDecoration: 'underline'}}
                                        >
                                            Log in with GitHub
                                        </span>
                                    </a>
                                </div>
                        }
                    </form>
                ) : (
                    <div style={{padding: '12px 0'}}>
                        <h6 className="css_da" style={{marginBottom: 6}}>Reviews</h6>
                        {
                            taggedreviews
                            .map(request_review => <div key={request_review.id}>
                                <div style={{display: 'inline-block', verticalAlign: 'middle', width: 115, overflow: 'hidden', textOverflow: 'ellipsis'}}>
                                    <UserSnippet.component user_id={request_review.author} />
                                </div>
                                {
                                    request_review.rejection_argument ?
                                    (
                                        <span>
                                            <FaClose className="css_color_red" />
                                            <span style={{verticalAlign: 'middle'}}>
                                                {' '}
                                                No
                                                {': '}
                                            </span>
                                            <span style={{verticalAlign: 'middle'}}>
                                                {request_review.rejection_argument}
                                            </span>
                                        </span>
                                    ) : (
                                        <span>
                                            <FaCheck className="css_color_green" />
                                            <span style={{verticalAlign: 'middle'}}>
                                                {' '}
                                                Yes
                                            </span>
                                        </span>
                                    )
                                }
                                {
                                    request_review.author === (Thing.things.logged_user||{}).id && (
                                        <button
                                          className="css_da css_secondary"
                                          onClick={this.toggle_edit_mode}
                                          style={{marginLeft: 16}}
                                        >
                                            <FaPencil />
                                            {' '}
                                            <span style={{verticalAlign: 'middle'}}>Edit</span>
                                        </button>
                                    )
                                }
                            </div>)
                        }
                        <div className="css_p css_note" style={{marginBottom: 0}}>
                            After enough approvals, <code className="css_da css_inline">{resource.npm_package_name}</code> will be added.
                        </div>
                    </div>
                )
            }
        </div>;
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

        const review_section = (() => { 
            if( resource.taggedreviews.length === 0 ) {
                return null;
            }
            return [
                <h2 key={0} className="css_da">Review</h2>,
                <TaggedReviewsSnippet key={1} resource={resource} />,
            ];
        })(); 

        const readme_section = (() => { 
            return [
                <h2 key={0} className="css_da">Readme</h2>,
                <div
                  key={1}
                  className="markdown-body"
                  style={{paddingBottom: 50}}
                  dangerouslySetInnerHTML={{__html: resource.github_info.readme}}
                />,
            ];
        })(); 

        return <div className="css_resource_details">
            { review_section }
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

