import React from 'react';
import MDSpinner from 'react-md-spinner';

const Loader = ({size}) => (
    <MDSpinner
        className="css_markdown_loader__react"
        size={size}
        color1="#bbb"
        color2="#aaa"
        color3="#999"
        color4="#888"
    />
);

export default Loader;
