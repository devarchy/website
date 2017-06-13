const long_term_cache = require('./long_term_cache');
const fetch = require('./fetch');
const assert = require('assert');


module.exports = long_term_cache({
    cache_name: 'fetch',
    function_to_cache: fetch,
    hash_input: fetch.hash_fetch_input,
    entry_expiration: (() => {
        const ONE_DAY = 24*60*60*1000;
        return ONE_DAY*10;
    })(),
});
