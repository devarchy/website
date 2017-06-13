import React from 'react';
import FlipMove from 'react-flip-move';


const FlipListMixin = props => <FlipMove {...Object.assign({}, props, {enterAnimation: "none", leaveAnimation: 'none'})} />

export default FlipListMixin;
