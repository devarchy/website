import React from 'react'
import assert from 'assert';
import classNames from 'classnames';

import {is_npm_package_name_valid__text} from '../../util/npm_package_name_validation';

import rerender from '../../rerender';

import Thing from '../../thing';
import Resource from '../../thing/resource';
import Tag from '../../thing/tag';

import FaCheck from 'react-icons/lib/fa/check';

import LoginRequired from '../snippets/login-required';




const Inputs = (() => {
    const inputs = inputs_spec().map(InputFactory);

    return {
        inputs,
        main_input_name({is_npm_section, is_web_section}) {
            const inps =
                inputs.filter(inp => !!inp.for_npm_section === !!is_npm_section && !!inp.for_web_section === !!is_web_section && inp.is_main);
            assert(inps.length===1);
            return inps[0].input_name;
        },
        get inputs_cleared() {
            return inputs.reduce((obj, inp) => Object.assign(obj, {[inp.input_name]: ''}), {});
        },
    };

    function InputFactory(spec) { 
        return {
            input_name: spec.input_name,
            is_main: spec.is_main,
            for_npm_section: spec.for_npm_section,
            for_web_section: spec.for_web_section,
            element: ({errors, value, on_change}) =>
                <label key={spec.input_name}>
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
                                <span className="css_color_red">
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
                for_npm_section: true,
            },
            {
                input_name: 'npm_package_name',
                label: errors =>
                    <span>
                        Library's npm package
                        {
                            !errors ? ' *' :
                                <span className="css_color_red">
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
                for_npm_section: true,
            },
            {
                input_name: 'resource_url',
                label: errors =>
                    <span>
                        URL
                        {
                            !errors ? ' *' :
                                <span className="css_color_red">
                                {' is '}
                                {
                                    errors.is_missing &&
                                        'required'
                                }
                                </span>
                        }
                    </span>,
                placeholder: "www.example.com",
                is_main: true,
                for_web_section: true,
            },
            /*
            {
                input_name: 'resource_title',
                label: errors =>
                    <span>
                        Name
                        {
                            !errors ? ' *' :
                                <span className="css_color_red">
                                {' is '}
                                {
                                    errors.is_missing &&
                                        'required'
                                }
                                </span>
                        }
                    </span>,
                placeholder: "Super Example App",
                for_web_section: true,
            },
            */
        ];
    } 
})();

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

        const is_npm_section = this.tag__category.is_npm_section;
        const is_web_section = this.tag__category.is_web_section;
        assert(!!is_web_section !== !!is_npm_section);

        const resource_info = {
            tag__markdown_list: this.tag__markdown_list,
            tag__category: this.tag__category,
        };

        if( is_npm_section ) {
            resource_info.is_npm_entry = true;
        }

        Inputs
        .inputs
        .filter(({for_npm_section, for_web_section}) => !!is_npm_section === !!for_npm_section && !!is_web_section === !!for_web_section)
        .forEach(({input_name}) => {resource_info[input_name] = this.state[input_name]});

        Resource
        .add_to_markdown_list(resource_info)
        .then(() => {
            rerender.carry_out();
            this.resetState(Object.assign({added: true,}, Inputs.inputs_cleared));
            this.refs[Inputs.main_input_name({is_npm_section, is_web_section})].focus();
        })
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
            this.refs[Inputs.main_input_name({is_npm_section, is_web_section})].focus();
            throw err;
        })
    },
    getInitialState: function() {
        this.tag__markdown_list = Tag.get_by_name(this.props.tag__markdown_list__name);
        this.tag__category = Tag.get_by_name(this.props.tag__category__name);

        assert(this.tag__markdown_list);
        assert(this.tag__markdown_list.is_markdown_list);
        assert(this.tag__category);
        assert(this.tag__category.is_markdown_category);
        assert(!!this.tag__category.is_npm_section === !this.tag__category.is_web_section);

        return (
            Object.assign(
                {
                    error_message: null,
                    added: false,
                    loading: false,
                    validation_errors: null,
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
        this.resetState({[input_name]: event.target.value});
    },
    componentDidMount: function() {
        const is_npm_section = this.tag__category.is_npm_section;
        const is_web_section = this.tag__category.is_web_section;
        // not using autoFocus but delaying focus because of layout issues with `react-collapse`
        setTimeout(() => {
            if( ! this.isMounted() ) return;
            this.refs[Inputs.main_input_name({is_npm_section, is_web_section})].focus();
        }, 300);
    },
    render: function() {

        const is_npm_section = this.tag__category.is_npm_section;
        const is_web_section = this.tag__category.is_web_section;
        assert(!!is_web_section !== !!is_npm_section);

        const disabled = this.state.loading || !Thing.things.logged_user;

        return <div>
            <form className={classNames({css_saving: this.state.loading})} onSubmit={this.add_resource}>
                <fieldset className="css_da" disabled={disabled}>
                    <div>{
                        Inputs
                        .inputs
                        .filter(({for_npm_section, for_web_section}) => !!is_npm_section === !!for_npm_section && !!is_web_section === !!for_web_section)
                        .map(
                            inp => inp.element({
                                errors: (this.state.validation_errors||{})[inp.input_name],
                                value: this.state[inp.input_name],
                                on_change: this.handle_on_change.bind(this, inp.input_name),
                            })
                        )
                    }</div>
                    <br/>
                    <button
                      className="css_primary_button css_da css_async_action_button"
                      disabled={disabled}
                    >
                        <span className="css_color_contrib">Add Entry</span>
                    </button>
                </fieldset>
            </form>
            <LoginRequired.component text={'to add an entry'}/>
            { this.state.error_message && <div className="css_p css_color_red" style={{whiteSpace: 'pre-wrap'}}>{this.state.error_message}</div> }
            { this.state.added &&
                <div className="css_p css_color_green">
                    <FaCheck className="css_color_green" />
                    <span style={{verticalAlign: 'middle'}}>{' '}ADDED</span>
                </div>
            }
            { this.tag__category.is_npm_section &&
                (() => {
                    const issue_list_link = 'github.com/'+this.tag__markdown_list.markdown_list__github_full_name+'/issues';
                    return (
                        <div className="css_p css_note" style={{paddingTop: 10, marginBottom: 0}}>
                            <span>
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
                        </div>
                    );
                })()
            }
        </div>;

    },
}); 


export default {
    component: AddResourceSnippet,
}
