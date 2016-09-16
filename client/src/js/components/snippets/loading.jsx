import React from 'react';

const LoadingSnippet = React.createClass({
    render: function(){
        return (
            <div
              style={Object.assign({display: 'block', textAlign: 'center'}, this.props.style)}
            >
                <i
                  className="fa fa-circle-o-notch fa-spin"
                  style={{color: '#555'}}
                />
            </div>
        );
    }
});

export default {
    component: LoadingSnippet,
};
