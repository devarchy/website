import React from 'react';

/*
import Loader from './css-loader';
/*/
import Loader from './react-loader';
//*/


const LoadingSnippet = React.createClass({
    render: function(){

        const size = this.props.size || 44*(this.props.scale||1);

        const style = {
            overflow: 'hidden',
        };

        if( this.props.center_loader ) {
            Object.assign(style, {
                display: 'flex',
                minWidth: size,
                minHeight: size,
                width: '100%',
                height: '100%',
                position: 'absolute',
                justifyContent: 'center',
                alignItems: 'center',
                top: 0,
                left: 0,
            })
        } else {
            Object.assign(style, {display: 'block', textAlign: 'center'});
        }

        Object.assign(style, this.props.style);

        return (
            <div
              style={style}
              className={this.props.className}
            >
                <Loader size={size} />
            </div>
        );
    }
});

export default {
    component: LoadingSnippet,
};
