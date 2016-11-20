const long_term_cache = require('./long_term_cache');
const fetch = require('./fetch');
const assert = require('assert');


module.exports = long_term_cache({ 
    function_to_cache: fetch,
    hash_input: ({url, method='GET', headers}) => {
        assert(url && method);
        return (
            method + ' ' + url +
            (headers ? (' '+JSON.stringify(headers)) : '')
        );
    },
    entry_expiration: (() => {
        const ONE_DAY = 24*60*60*1000;
        return ONE_DAY*10;
    })(),
    cache_name: 'fetch',
    /*
    ignore_cache_entry: ({response_connection_error, response_status_code}) => {
        assert(response_connection_error || response_status_code);
        return (
            response_connection_error ||
            response_status_code===403 || // 403 -> API rate limit exceeded
            response_status_code.toString().startsWith('5')
        );
    },
    */
}); 
