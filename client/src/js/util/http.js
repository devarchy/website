import assert from 'assert';
import fetch from 'isomorphic-fetch';
import Promise from 'bluebird';
import timerlog from 'timerlog';
import ExtendableError from 'extendable-error-class';
Promise.longStackTraces();


const http = function({uri, method, body, json, qs, withCredentials = true, }) {
    const headers = {};

    if( json ) {
        body = JSON.stringify(body);
        headers['Accept'] = 'application/json';
        headers['Content-Type'] = 'application/json';
    }

    if( qs ) {
        uri += build_query_string(qs);
        qs = null;
    }

    const log_id = timerlog({tag: 'performance', start_timer: true, message: method+' '+uri, disabled: false});
    return (
        new Promise((resolve, reject) => {
            fetch( uri, {
                    method,
                    headers,
                    body,
                    credentials: withCredentials ? 'include' : 'same-origin',
            })
            .then(resp => resolve(resp))
            .catch(err => reject(err))
        })
    )
    .finally(() => {timerlog({id: log_id, end_timer: true})})
    .then(resp => process_response(resp, method, json))
};


class HttpError extends ExtendableError {
    constructor(response) {

        const message =
            (response.body||{}).message
                ||
            'HttpError: ' +
            [
                response.status,
                response.method,
                response.url,
                response.statusText,
            ].filter(v => !!v).join(' ');

        super(message);

        Object.assign(this, response);
        this.message = message;

    }
    toString() { return this.message }
};


http.HttpError = HttpError;
module.exports = http;


function process_response(response, method, json) {
    const response_copy = {};
    [
        'status',
        'statusText',
        'url',
        'method',
    ]
    .forEach(p => response_copy[p] = response[p]);

    return (
        Promise.resolve()
    )
    .then(() => json && response.json().then(response_body => {response_copy.body = response_body}))
    .then(() => {
        if (response_copy.status >= 200 && response_copy.status < 300) {
            return response_copy.body;
        } else {
            throw new HttpError(response_copy);
        }
    });
}

function build_query_string(params) {
    const str = [];
    for(let p in params) {
        if (params.hasOwnProperty(p)) {
            str.push(encodeURIComponent(p) + "=" + encodeURIComponent(params[p]));
        }
    }
    return '?'+str.join("&");
}
