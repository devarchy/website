import React from 'react';

class RenderCanceler extends React.Component {
    constructor(props) {
        super(props);
    }
    render() {
        return <div>You shoud never see this &lt;RenderCanceler/&gt;</div>
}
}
RenderCanceler.displayName = 'RenderCanceler';

export default RenderCanceler;
