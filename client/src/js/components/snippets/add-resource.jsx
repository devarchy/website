import React from 'react'
import assert from 'assert';
import classNames from 'classnames';

import {is_npm_package_name_valid__text} from '../../util/npm';

import rerender from '../../rerender';

import Thing from '../../thing';
import Resource from '../../thing/resource';
import Tag from '../../thing/tag';

import FaCheck from 'react-icons/lib/fa/check';

import LoginRequired from '../snippets/login-required';


const AddResourceSnippet = React.createClass({ 
    propTypes: {
        tag__markdown_list__name: React.PropTypes.string.isRequired,
        tag__category__name: React.PropTypes.string.isRequired,
    },
    add_resource: function(event) {
        event.preventDefault();
        this.resetState( {loading: true} );

        assert(this.tag__markdown_list);
        assert(this.tag__category);

        Resource
        .add_to_markdown_list({
            github_full_name: this.state.inputval__github_full_name,
            npm_package_name: this.state.inputval__npm_package_name,
            tag__markdown_list: this.tag__markdown_list,
            tag__category: this.tag__category,
        })
        .then(() => {
            rerender.carry_out();
            this.resetState({
                added: true,
                inputval__github_full_name: '',
                inputval__npm_package_name: '',
            });
            this.focus_github_input();
        })
        .catch(err => {
            if( err.validation_errors ) {
                this.resetState({validation_errors: err.validation_errors});
                this.refs[err.validation_errors.github_full_name?'input__github_full_name':'input__npm_package_name'].focus();
                return;
            }

            const message =
                err.constructor === assert.AssertionError ?
                    'Something went wrong. Try again?' :
                    err.message ;
            this.resetState({error_message: message});
            this.refs[message.toLowerCase().includes('github')?'input__github_full_name':'input__npm_package_name'].focus();
            throw err;
        })
    },
    getInitialState: function() {
        return {
            error_message: null,
            added: false,
            loading: false,
            validation_errors: null,
            inputval__github_full_name: '',
            inputval__npm_package_name: '',
        };
    },
    resetState: function(stateChanges={}){
        const states_to_keep = ['inputval__github_full_name', 'inputval__npm_package_name'];
        if( ! this.isMounted() ) return;
        const old_states_to_keep = {};
        states_to_keep.forEach(key => old_states_to_keep[key] = this.state[key]);
        this.setState(Object.assign(this.getInitialState(), old_states_to_keep, stateChanges));
    },
    handle_github_change: function(event) {
        this.resetState({inputval__github_full_name: event.target.value});
    },
    handle_npm_change: function(event) {
        this.resetState({inputval__npm_package_name: event.target.value});
    },
    focus_github_input: function() {
        // not using autoFocus and delaying focus because of layout issues with `react-collapse`
        setTimeout(() => {
            if( ! this.isMounted() ) return;
            this.refs['input__github_full_name'].focus();
        }, 300);
    },
    componentDidMount: function() {
        this.focus_github_input();
    },
    render: function() {

        this.tag__markdown_list = Tag.get_by_name(this.props.tag__markdown_list__name);
        this.tag__category = Tag.get_by_name(this.props.tag__category__name);

        assert(this.tag__markdown_list);
        assert(this.tag__markdown_list.is_markdown_list);
        assert(this.tag__category);
        assert(this.tag__category.is_markdown_category);

        const disabled = this.state.loading || !Thing.things.logged_user;

        return <div>
            <form className={classNames({css_saving: this.state.loading})} onSubmit={this.add_resource}>
                <fieldset className="css_da" disabled={disabled}>
                    <div>
                        <label>
                            <div className="css_description_label">
                                Library's GitHub repository
                                {
                                    (this.state.validation_errors||{}).github_full_name &&
                                        <span className="css_color_red">
                                        {' is '}
                                        {
                                            this.state.validation_errors.github_full_name.is_malformatted &&
                                                'malformatted (`https://github.com/organization/repository` is expected with no `/` in `organization` and `repository`)' ||
                                            this.state.validation_errors.github_full_name.is_missing &&
                                                'required'
                                        }
                                        </span>
                                }
                            </div>
                            <div
                              className="css_input_wrapper"
                              style={{width: 420}}
                            >
                                <span className="css_input_wrapper__prefix">
                                    https://github.com/
                                </span>
                                <input
                                  type="text"
                                  ref="input__github_full_name"
                                  value={this.state.inputval__github_full_name}
                                  placeholder="organization/repository"
                                  onChange={this.handle_github_change}
                                />
                            </div>
                        </label>
                    </div>
                    <div>
                        <label>
                            <div className="css_description_label">
                                Library's NPM package
                                {
                                    (this.state.validation_errors||{}).npm_package_name &&
                                        <span className="css_color_red">
                                        {' is '}
                                        {
                                            this.state.validation_errors.npm_package_name.is_malformatted &&
                                                'malformatted ('+is_npm_package_name_valid__text+')' ||
                                            this.state.validation_errors.npm_package_name.is_missing &&
                                                'required'
                                        }
                                        </span>
                                }
                            </div>
                            <div
                              className="css_input_wrapper"
                              style={{width: 420}}
                            >
                                <span className="css_input_wrapper__prefix">
                                    https://www.npmjs.com/package/
                                </span>
                                <input
                                  type="text"
                                  ref="input__npm_package_name"
                                  value={this.state.inputval__npm_package_name}
                                  placeholder="npm-package-name"
                                  onChange={this.handle_npm_change}
                                />
                            </div>
                        </label>
                    </div>
                    <br/>
                    <button
                      className="css_primary_button css_da css_async_action_button"
                      disabled={disabled}
                    >
                        <span className="css_color_contrib">Add Entry</span>
                    </button>
                    {/*
                    <span className="css_note">
                        <span style={{padding: '0 4px'}}>
                            {' to '}
                        </span>
                        <code className="css_da css_inline" style={{fontSize: '1.1em'}}>
                            {this.tag__category.display_category({without_root: true})}
                        </code>
                    </span>
                    */}
                </fieldset>
            </form>
            <LoginRequired.component text={'to add an entry'}/>
            { this.state.error_message && <div className="css_p css_color_red" style={{whiteSpace: 'pre'}}>{this.state.error_message}</div> }
            { this.state.added &&
                <div className="css_p css_color_green">
                    <FaCheck className="css_color_green" />
                    <span style={{verticalAlign: 'middle'}}>{' '}ADDED</span>
                </div>
            }
            <div className="css_p css_note" style={{paddingTop: 10, marginBottom: 0}}>
                {(() => {
                    const issue_list_link = 'github.com/'+this.tag__markdown_list.markdown_list__github_full_name+'/issues';
                    return <span>
                        If an entry doesn't fit any category,
                        create an issue at
                        {' '}
                        <a
                          className="css_da"
                          target="_blank"
                          href={'https://'+issue_list_link}
                        >
                          {issue_list_link}
                        </a>
                        .
                    </span>
                })()}
            </div>
        </div>;

    },
}); 


export default {
    component: AddResourceSnippet,
}
