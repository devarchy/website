import React from 'react';
import classNames from 'classnames';

import FaPencil from 'react-icons/lib/fa/pencil';
import FaCaretUp from 'react-icons/lib/fa/caret-up';
import FaCaretDown from 'react-icons/lib/fa/caret-down';
import FaChain from 'react-icons/lib/fa/chain';
import FaInfo from 'react-icons/lib/fa/info';
import FaCircle from 'react-icons/lib/fa/circle';
import FaCalendarPlusO from 'react-icons/lib/fa/calendar-plus-o';
import FaMagic from 'react-icons/lib/fa/magic';
import MdCheck from 'react-icons/lib/md/check';
import MdCake from 'react-icons/lib/md/cake';
import FaTrashO from 'react-icons/lib/fa/trash-o';
import GoPlus from 'react-icons/lib/go/plus';
import IoWorldOutline from 'react-icons/lib/io/ios-world-outline';
import TiHome from 'react-icons/lib/ti/home';
//import FaMapO from 'react-icons/lib/fa/map-o';
import TiInfoLarge from 'react-icons/lib/ti/info-large';
import FaBars from 'react-icons/lib/fa/bars';
import IoSearchStrong from 'react-icons/lib/io/ios-search-strong';
//import GoCode from 'react-icons/lib/go/code';
//import FaEllipsisV from 'react-icons/lib/fa/ellipsis-v';
//import GoLightBulb from 'react-icons/lib/go/light-bulb';

// playground
// - Inline formating tests: https://jsfiddle.net/wg22prm8/6/

// Other attempts
// - Plus Icon with + char: https://jsfiddle.net/fkj6t6oy/1/ -- works in Chrome but not Firefox
// - Plus Icon with 2 lines: https://jsfiddle.net/fkj6t6oy/5/ -- doesn't work for small sizes
const IconPlus = ({rotate_to_cross, className, ...props}) => (
    <div
      className={classNames(className, rotate_to_cross?"css_icon_cross":"css_icon_plus")}
      {...props}
    />
);

const IconPlus2 = props => <GoPlus {...props} />;

const IconCross = ({className, ...props}) => <IconPlus className={classNames(className, /*"css_1px_up"*/)} rotate_to_cross={true} {...props} />;

// Note that hypen != minus sign: http://graphicdesign.stackexchange.com/questions/74278/why-is-the-minus-sign-not-on-the-same-height-as-the-plus-sign
const IconMinus = () => <div className="css_icon_minus" />;

const IconCheck = props => <MdCheck {...props} />;

export const IconDone = IconCheck;

export const IconAdd = IconPlus;

export const IconAdd2 = IconPlus2;

export const IconPro = IconPlus;

export const IconCon = IconMinus;

export const IconRemove = IconCross;

export const IconClose = IconCross;

export const IconDisagree = IconCross;

export const IconAgree = IconCheck;

export const IconEdit = props => <FaPencil className="css_1px_up" {...props}/>;

export const IconUpvote = () => <FaCaretUp className="css_1px_up" />;

export const IconDownvote = () => <FaCaretDown className="css_1px_down"/>;

export const IconLink = () => <FaChain />;

export const IconDesc = () => <FaInfo className="css_1px_up"/>;

export const IconTitle = () => <FaCircle className="css_1px_up"/>;

export const IconPublishedAt = () => <FaCalendarPlusO className="css_1px_up"/>;

export const IconAge = () => <MdCake className="css_1px_up"/>;
//export const IconAge = IconPublishedAt;

export const IconAppeardAt = () => <FaMagic />;

export const IconDelete = () => <FaTrashO className="css_1px_up" />;

//export const IconHomepage = () => <IoWorldOutline style={{fontSize: '1.15em'}} className="css_1px_up" />;
export const IconHomepage = () => <TiHome style={{fontSize: '1.15em'}} className="css_2px_up" />;

export const IconDevarchy = () => <div className="css_icon_devarchy" />;

//export const IconAbout = () => <FaMapO />;
export const IconAbout = () => <TiInfoLarge className="css_1px_up css_2px_left" style={{fontSize: '1.2em'}}/>;

//export const IconCatalogList = () => <FaEllipsisV />;
export const IconCatalogList = () => <FaBars className="css_1px_left css_1px_up" style={{width: 14}} />;

export const IconSearch = ({className, style}) => <IoSearchStrong className={className} style={style} />;

//export const IconSourceCode = () => <GoCode/>;
export const IconSourceCode = () => <i className="octicon octicon-code css_2px_down" style={{fontSize: '1.15em'}}/>;

//export const IconFeedback = () => <GoLightBulb/>;
export const IconFeedback = () => <i className="octicon octicon-light-bulb css_1px_down" style={{fontSize: '1.03em'}}/>;

export const IconChat = () => (
    <span
      style={{
          backgroundColor: '#50e3c2',
          width: 8,
          height: 8,
          marginLeft: 2,
          marginRight: 4,
          display: 'inline-block',
          borderRadius: '100%',
      }}
    />
);

