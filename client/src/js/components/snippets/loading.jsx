import React from 'react';

import FaCircleONotch from 'react-icons/lib/fa/circle-o-notch';

const LoadingSnippet = React.createClass({
    render: function(){
        return (
            <div
              style={Object.assign({display: 'block', textAlign: 'center'}, this.props.style)}
            >
                <FaCircleONotch
                  className="css_spin"
                  style={{color: '#555'}}
                />
            </div>
        );
    }
});

export default {
    component: LoadingSnippet,
};
