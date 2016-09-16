export const SERVER_URI =
    (() => {
        if( typeof window === 'undefined' ) {
            return 'http://localhost:8081';
            // assert( typeof global !== 'undefined' && global.server_uri);
            // return global.server_uri;
        }
        if( window.location.hostname !== 'localhost' )
            return window.location.origin;
        return window.location.protocol + '//' + window.location.hostname + ':8081';
    })();
