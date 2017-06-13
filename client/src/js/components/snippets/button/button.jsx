import React from 'react';

import assert from 'assertion-soft';
import assert_soft from 'assertion-soft';
import classNames from 'classnames';

import Thing from '../../../thing';

import LinkMixin from '../../mixins/link';

const IconButton = ({icon, text, is_pressed, is_saving, is_async, disabled, allow_anonymous, alt, onClick, style}) => {

 // assert_soft(util.check_type(icon).is_react_element);
 // assert_soft(!text || util.check_type(text).is_react_element);

    disabled = disabled || !allow_anonymous && !Thing.things.logged_user;

    if( is_pressed ) {
        text = negate_verb(text);
        alt = negate_verb(alt);
    }

    return (
        <div
          className={classNames(
              "css_button_icon",
              {
                  css_is_async: is_async,
                  css_is_saving: is_saving,
                  css_is_pressed: is_pressed,
              }
          )}
          onClick={!disabled && onClick}
          disabled={disabled}
          alt={alt}
          title={alt}
          style={style}
        >
        <div
          className={classNames(
              "css_button_icon__icon css_tag_color__border",
              is_pressed && "css_tag_color__text"
          )}
          children={icon}
        />
        { text &&
            <span
              style={{paddingLeft: 7, verticalAlign: 'middle', position: 'relative', bottom: 1}}
              children={text}
            />
        }
        </div>
    );
};

const TextButtonSnippet = ({text, is_async, is_saving, onClick, disabled, is_pressed, allow_anonymous}) => {

 // assert_soft(util.check_type(text).is_react_element);

    disabled = disabled || !allow_anonymous && !Thing.things.logged_user;

    if( is_pressed ) {
        text = negate_verb(text);
    }

    return (
        <span
          className={classNames(
              "css_button_text",
              {
                  css_is_async: is_async,
                  css_is_saving: is_saving,
                  css_is_pressed: is_pressed,
              }
          )}
          onClick={!disabled && onClick}
          disabled={disabled}
        >
            {text}
        </span>
    );
};

const BigButtonSnippet = props => {
    let btn = (
        <span
          className="css_button_big"
          style={props.style}
        >
            {props.children}
        </span>
    );

    if( props.link ) {
        btn = (
            <LinkMixin to={props.link} track_info={{action: props.link+' [big button]'}}>
                {btn}
            </LinkMixin>
        );
    }

    return btn;
};

/*
const util = {
    check_type: (() => { 
        const FctComponent = () => <div/>;
        class ClsComponent {render(){return <div/>;}};
        const Es5Component = React.createClass({render: () => <div/>});

        [FctComponent, ClsComponent, Es5Component]
        .forEach(Component => {
            {
                const {is_react_class, is_react_element} = check(Component);
                assert_soft(is_react_class === true && is_react_element === false);
            }
            {
                const {is_react_class, is_react_element} = check(<Component/>);
                assert_soft(is_react_class === false && is_react_element === true);
            }
        });

        return check;
        function check(obj) {
            return {
                is_cls: !!obj && typeof (obj.render || obj) === "function",
                is_react_element: !obj || !!obj.props || obj.constructor === String,
            };
        }
    })() 
};
*/

function negate_verb(str) { 
    if( !str ) return str;
    if( str.constructor!==String ) return str;
    if( str.includes(' ') ) return str;
    const prefix = str[0].toLowerCase()===str[0] ? 'un-' : 'Un-';
    str = prefix+str.toLowerCase();
    return str;
} 

const debug_show = () => ( 
    [
        {verticalAlign: 'baseline', background: 'black'},
        {verticalAlign: 'middle', background: 'blue'},
    ].map((style, i) =>
        <span
          key={i}
          style={Object.assign(style, {display: 'inline-block', width: 20, height: 1})}
        />
    )
); 

export default IconButton;
export {BigButtonSnippet, TextButtonSnippet, IconButton};
