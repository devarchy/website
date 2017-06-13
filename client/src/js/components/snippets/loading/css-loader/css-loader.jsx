import React from 'react';

// https://codepen.io/jczimm/pen/vEBpoL
const Loader = ({size}) => (
    <svg className="circular" viewBox="25 25 50 50" width={size} height={size}>
        <circle className="path" cx="50" cy="50" r="20" fill="none" strokeWidth="5" strokeMiterlimit="10"/>
    </svg>
);

export default Loader;
