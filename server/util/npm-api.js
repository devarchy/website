const packageJson = require('package-json');
const NetworkConnectionError = require('./network_connection_error');


module.exports = {
    get_package_json: npm_package_name =>
        make_promise_pushy(() => packageJson(npm_package_name))
        .catch(err => {
            const connection_problem_reason =  NetworkConnectionError.check_error_object(err);
            if( connection_problem_reason ) {
                throw new NetworkConnectionError("Could not connect to NPM's registry: "+connection_problem_reason);
            }
            throw err;
        }),
    url: 'https://www.npmjs.com/package/',
    is_npm_package_name_valid: npm_package_name =>
        /^[a-zA-Z0-9\-\.\_]+$/.test(npm_package_name) &&
        /^[a-zA-Z0-9]/.test(npm_package_name) &&
        /[a-zA-Z0-9]$/.test(npm_package_name) ,
};


function make_promise_pushy(promise_fct) { 
    var attempts_left = 10;

    return run_attempt();

    function run_attempt() {
        return (
            promise_fct()
        )
        .catch(err => {
            if( err &&
                [
                    503, // 503 -> temporary unavailable
                    502, // 502 -> gateway received invalid response
                ].includes(err.statusCode)
            ) {
                if( --attempts_left > 0 ) {
                    return run_attempt();
                }
            }
            throw err;
        });
    }
} 
