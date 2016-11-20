import React from 'react';

/*
import GoLightBulb from 'react-icons/lib/go/light-bulb';
import GoCode from 'react-icons/lib/go/code';
*/
import FaBars from 'react-icons/lib/fa/bars';

const FooterSnippet = () =>
    <div className="css_more">
        <FaBars
          className="css_more_icon"
          style={{
            fontSize: '3.4em',
            position: 'absolute',
            color: '#ddd',
            margin: 'auto',
            display: 'inline-block',
            width: 40,
            height: 40,
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            margin: 'auto',
          }}
        />
        <a
          className="css_da"
          href="https://github.com/brillout/devarchy/issues"
          target="_blank"
        >
            {/*
            <GoLightBulb/>
            */}
            <i className="octicon octicon-light-bulb css_da"/>
            {' '}
            Feedback
        </a>
        <a
          className="css_da"
          href="https://github.com/brillout/devarchy"
          target="_blank"
        >
            {/*
            <GoCode/>
            */}
            <i className="octicon octicon-code css_da"/>
            {' '}
            Source code
        </a>
    </div>;

export default {
    component: FooterSnippet,
};
