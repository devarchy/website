import React from 'react'
import assert from 'assertion-soft';
import assert_soft from 'assertion-soft';
import classNames from 'classnames';

import {is_npm_package_name_valid__text} from '../../util/npm_package_name_validation';

import rerender from '../../rerender';

import Thing from '../../thing';
import Resource from '../../thing/resource';
import Tag from '../../thing/tag';

import {IconDone} from '../snippets/icon';
import LoginRequired from '../snippets/login-required';
import ButtonSnippet from '../snippets/button';
import LinkMixin from '../mixins/link';


const ThingQuote = ({text}) => <code className="css_da">{text}</code>;

const AddResourceSnippet = React.createClass({
    render: function() { 

        const entries_type = this.tag_category.entries_type;
        assert(entries_type);

        const disabled = this.state.loading || !Thing.things.logged_user;

        const tag_category__display = (
            <ThingQuote text={this.tag_category.category__title} />
        );

        const thing_resource__display = (
            this.thing_resource && (
                <ThingQuote text={this.thing_resource.resource_name} />
            )
        );

        const side_categories_selection = (() => {
            if( !this.state.resource_to_be_processed || !assert_soft(this.thing_resource) ) {
                return null;
            }

            const all_categories = this.thing_resource.get_all_categories(this.tag_catalog);

            return (
                <div className="css_p">
                    {
                        all_categories
                        .filter(tc => tc.id!==this.tag_category.id)
                        .map(tc => {
                            if( ! assert_soft(tc.is_category) ) return;
                            const cat_name = tc.name;
                            return (
                                <div key={tc.id}>
                                    <label className="css_da">
                                        <input
                                          type="checkbox"
                                          className="css_da"
                                          checked={!this.state.side_categories_not_to_remove[cat_name]}
                                          onChange={ev => {
                                              const {side_categories_not_to_remove} = this.state;
                                              if( ! ev.target.checked ) {
                                                  side_categories_not_to_remove[cat_name] = true;
                                              }
                                              else {
                                                  delete side_categories_not_to_remove[cat_name];
                                              }
                                              this.setState({
                                                  side_categories_not_to_remove,
                                              });
                                          }}
                                        />
                                        Remove {thing_resource__display} from <ThingQuote text={tc.category__title}/>
                                    </label>
                                </div>
                            );
                        })
                    }
                </div>
            );
        })();

        return (
            <form className={classNames({css_saving: this.state.loading})} onSubmit={this.add_resource}>
                <fieldset className="css_da" disabled={disabled}>
                    {/*
                    trick to make pressing enter call form.onSubmit
                    - http://stackoverflow.com/questions/6317761/pressing-enter-submits-html-form-with-one-input-but-not-two
                    */}
                    <button
                      style={{visibility: 'hidden', height: 0, padding:0, border: 0, position: 'absolute', top: -100, left: -100}}
                      type="submit"
                    />
                    <div>{
                        Inputs
                        .inputs
                        .filter(({for_entries_type}) => entries_type===for_entries_type)
                        .map(
                            inp => inp.element({
                                errors: (this.state.validation_errors||{})[inp.input_name],
                                value: this.state[inp.input_name],
                                on_change: this.handle_on_change.bind(this, inp.input_name),
                            })
                        )
                    }</div>
                    { this.state.resource_checked && green_block(<span>Library {thing_resource__display} successfully checked</span>) }
                    {/*
                    { this.state.resource_checked && !this.state.resource_to_be_processed && green_block(<span>Library {thing_resource__display} successfully updated</span>) }
                    */}
                    { side_categories_selection }
                    { this.state.error_message && <div className="css_p css_color_error" style={{whiteSpace: 'pre-wrap'}}>{this.state.error_message}</div> }
                    { this.state.resource_added && green_block(<span>Library {thing_resource__display} added to {tag_category__display}</span>) }
                    <div className="css_p">
                        <ButtonSnippet
                          disabled={disabled}
                          is_async={true}
                          onClick={this.add_resource}
                          icon={<IconDone/>}
                          text={this.state.resource_to_be_processed ? <span>Add {thing_resource__display} to {tag_category__display}</span> : 'Check Library'}
                        />
                    </div>
                    <LoginRequired.component className="css_p" text={'to add a library'}/>
                    { entries_type !== 'web_entries' &&
                        (() => {
                            if( this.props.is_need_view ) {
                                return null;
                            }
                            const repo_link = 'https://github.com/'+this.tag_catalog.markdown_list__github_full_name;
                            return (
                                <div className="css_p css_note" style={{paddingTop: 10, marginBottom: 0}}>
                                    <span>
                                        If a library doesn't fit any category
                                        create an issue or PR at <LinkMixin url={repo_link}/>.
                                    </span>
                                </div>
                            );
                        })()
                    }
                </fieldset>
            </form>
        );

        function green_block(child) {
            return (
                <div className="css_p css_color_green">
                    <IconDone style={{fontSize: '1.4em'}} className="css_1px_down" />
                    <span style={{verticalAlign: 'middle'}}>{' '}{child}</span>
                </div>
            );
        }

    }, 
    propTypes: { 
        tag__markdown_list__name: React.PropTypes.string.isRequired,
        tag_category_id: React.PropTypes.string.isRequired,
    }, 
    add_resource: function(event) { 
        event.preventDefault();

        this.resetState({
            loading: true,
            resource_checked: this.state.resource_checked,
            resource_to_be_processed: this.state.resource_to_be_processed,
            side_categories_not_to_remove: this.state.side_categories_not_to_remove,
        });

        const {tag_catalog, tag_category, thing_resource} = this;
        assert(tag_catalog);
        assert(tag_category);

        const all_categories = thing_resource && thing_resource.get_all_categories(tag_catalog);

        const categories_to_remove = all_categories && (
            all_categories
            .filter(tc => !this.state.side_categories_not_to_remove[tc.name])
            .filter(tc => tc.id!==tag_category.id)
        );

        const entries_type = this.tag_category.entries_type;

        const is_npm_entry = entries_type === 'npm_entries';

        const resource_info = {};
        Inputs
        .inputs
        .filter(({for_entries_type}) => for_entries_type===entries_type)
        .forEach(({input_name}) => {resource_info[input_name] = this.state[input_name]});

        assert_soft( !this.state.resource_checked || thing_resource );
        assert_soft( !this.state.resource_to_be_processed || thing_resource );

        const action_promise = (
            (this.state.resource_to_be_processed && thing_resource) ? (
                thing_resource.alter_categories({
                    thing_resource,
                    tag_catalog,
                    tag_category,
                    categories_to_remove,
                })
                .then(() => {
                    this.resetState(Object.assign({resource_added: true,}, Inputs.inputs_cleared));
                    this.refs[Inputs.main_input_name({entries_type})].focus();
                })
            ) : (
                Resource
                .add_to_platform({
                    resource_info,
                    is_npm_entry,
                })
                .then(thing_resource => {
                    assert_soft(thing_resource);
                    this.thing_resource = thing_resource;
                    const all_categories = thing_resource && thing_resource.get_all_categories(tag_catalog);
                    const no_change = all_categories && all_categories.length===1 && all_categories[0].id===tag_category.id;
                    assert_soft([true, false].includes(no_change));
                    this.resetState({resource_checked: true, resource_to_be_processed: !no_change});
                    this.refs[Inputs.main_input_name({entries_type})].focus();
                })
            )
        );

        action_promise
        .catch(err => {
            if( err.validation_errors ) {
                this.resetState({validation_errors: err.validation_errors});
                Inputs.inputs.some(({input_name}) => {
                    if( err.validation_errors[input_name] ) {
                        this.refs[input_name].focus();
                        return true;
                    }
                });
                return;
            }

            const message =
                err.constructor === assert.AssertionError ?
                    'Something went wrong. Try again?' :
                    err.message ;
            this.resetState({error_message: message});
            this.refs[Inputs.main_input_name({entries_type})].focus();
            throw err;
        })
        .finally(() => {
            // rerender to
            // - make react-collapse adapt to new height
            // - in case of entry successfuly added -> add entry to list
            setTimeout(() => rerender.carry_out(), 100);
        })
    }, 
    getInitialState: function() { 
        this.tag_catalog = Tag.get_by_name(this.props.tag__markdown_list__name);
        this.tag_category = Tag.get_by_id(this.props.tag_category_id, {can_be_null: true});

        assert(this.tag_catalog);
        assert(this.tag_catalog.is_catalog);
        assert(this.tag_category);
        assert(this.tag_category.is_category);
        assert(this.tag_category.entries_type);

        return (
            Object.assign(
                {
                    error_message: null,
                    loading: false,
                    validation_errors: null,
                    resource_added: false,
                    resource_checked: false,
                    resource_to_be_processed: false,
                    side_categories_not_to_remove: {},
                },
                Inputs.inputs_cleared
            )
        );
    }, 
    resetState: function(stateChanges={}){ 
        if( ! this.isMounted() ) return;
        const states_to_keep = Inputs.inputs.map(({input_name}) => input_name);
        const old_states_to_keep = {};
        states_to_keep.forEach(key => old_states_to_keep[key] = this.state[key]);
        this.setState(Object.assign(this.getInitialState(), old_states_to_keep, stateChanges));
    }, 
    handle_on_change: function(input_name, event) { 
        this.resetState({
            [input_name]: event.target.value,
        });
    }, 
    componentDidMount: function() { 
        // not using autoFocus but delaying focus because of layout issues with `react-collapse`
        setTimeout(() => {
            if( ! this.isMounted() ) return;
            this.refs[Inputs.main_input_name({entries_type: this.tag_category.entries_type})].focus();
        }, 300);
    }, 
});

const supported_entries_type = ['npm_entries', 'web_entries'];

const Inputs = (() => { 
    const inputs = inputs_spec().map(InputFactory);

    return {
        inputs,
        main_input_name({entries_type}) {
            const inps =
                inputs.filter(({for_entries_type, is_main}) => for_entries_type===entries_type && is_main);
            assert(inps.length===1);
            return inps[0].input_name;
        },
        get inputs_cleared() {
            return inputs.reduce((obj, inp) => Object.assign(obj, {[inp.input_name]: ''}), {});
        },
    };

    function InputFactory(spec) { 
        assert(spec.for_entries_type);
        assert(supported_entries_type.includes(spec.for_entries_type));
        return {
            input_name: spec.input_name,
            is_main: spec.is_main,
            for_entries_type: spec.for_entries_type,
            element: ({errors, value, on_change}) =>
                <label key={spec.input_name} className="css_da">
                    <div className="css_description_label">
                        {spec.label(errors)}
                    </div>
                    <div
                      className="css_input_wrapper"
                      style={{width: 420}}
                    >
                        <span className="css_input_wrapper__prefix">
                            {spec.prefix}
                        </span>
                        <input
                          type="text"
                          ref={spec.input_name}
                          value={value}
                          placeholder={spec.placeholder}
                          onChange={on_change}
                        />
                    </div>
                </label>,
        };
    } 

    function inputs_spec() { 
        return [
            {
                input_name: 'github_full_name',
                label: errors =>
                    <span>
                        Library's GitHub repository
                        {
                            !errors ? ' *' :
                                <span className="css_color_error">
                                {' is '}
                                {
                                    errors.is_malformatted &&
                                        'malformatted (`https://github.com/organization/repository` is expected with no `/` in `organization` and `repository`)' ||
                                    errors.is_missing &&
                                        'required'
                                }
                                </span>
                        }
                    </span>,
                prefix: "https://github.com/",
                placeholder: "organization/repository",
                is_main: true,
                for_entries_type: "npm_entries",
            },
            {
                input_name: 'npm_package_name',
                label: errors =>
                    <span>
                        Library's npm package
                        {
                            !errors ? ' *' :
                                <span className="css_color_error">
                                {' is '}
                                {
                                    errors.is_malformatted &&
                                        'malformatted ('+is_npm_package_name_valid__text+')' ||
                                    errors.is_missing &&
                                        'required'
                                }
                                </span>
                        }
                    </span>,
                prefix: "https://www.npmjs.com/package/",
                placeholder: "npm-package-name",
                for_entries_type: "npm_entries",
            },
            {
                input_name: 'resource_url',
                label: errors =>
                    <span>
                        URL
                        {
                            !errors ? ' *' :
                                <span className="css_color_error">
                                {' is '}
                                {
                                    errors.is_missing &&
                                        'required'
                                }
                                </span>
                        }
                    </span>,
                placeholder: "http://example.com",
                is_main: true,
                for_entries_type: "web_entries",
            },
            /*
            {
                input_name: 'resource_name',
                label: errors =>
                    <span>
                        Name
                        {
                            !errors ? ' *' :
                                <span className="css_color_error">
                                {' is '}
                                {
                                    errors.is_missing &&
                                        'required'
                                }
                                </span>
                        }
                    </span>,
                placeholder: "Super Example App",
                for_entries_type: "web_entries",
            },
            */
        ];
    } 
})(); 


export default {
    component: AddResourceSnippet,
    supported_entries_type,
}
