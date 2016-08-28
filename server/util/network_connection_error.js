// const ExtendableError = require('extendable-error-class');

class NetworkConnectionError extends Error {
    constructor(m) { super(m); }
    static check_error_object(error) {
        if( ! error ) {
            return false;
        }
        if( error.constructor === this ) {
            return this.message || true;
        }
        if( ! error.code ) {
            return false;
        }
        if( ['EAI_AGAIN', 'ECONNRESET', ].includes(error.code) ) {
            if( 'EAI_AGAIN' ) {
                return "got `EAI_AGAIN` on `"+error.host+"`";
            } else {
                const request = error.response.request.method+' '+error.response.request.uri.pathname;
                const error_code = error.error.code;
                return "got `"+error_code+"` on `"+request+"`";
            }
        }
        return false;
    }
};

module.exports = NetworkConnectionError;
