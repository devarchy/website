const winston = require('winston');
const path = require('path');

const logs_dir_path = path.join(__dirname, '../.logs');

const LISTENERS = [
    {
        filter: event => event.event_type === 'request-error',
        print: event => event.error_info,
        file: path.join(logs_dir_path, 'errors.txt'),
    },
    {
        filter: event => event.event_type === 'response',
        print: event => decodeURIComponent(get_prop_val(event, 'url.path')),
        file: path.join(logs_dir_path, 'responses.txt'),
    },
    {
        filter: event => event.event_type === 'response' && get_prop_val(event, 'url.path') === '/api/user',
        print: () => 'new visit',
        file: path.join(logs_dir_path, 'visits.txt'),
    },
];


module.exports = function(server) {
    server.on('response', event => {
        event.event_type = 'response';
        on_event(event);
    });

    server.on('request-error', (event, err) => {
        event.event_type = 'request-error';
        event.error_info = err;
        on_event(event);
    });

    create_loggers();
};


function on_event(event) {
    LISTENERS.forEach(listener => {
        if( ! listener.filter(event) ) return;

        const msg = listener.print(event);

        const data = {
            user: get_prop_val(event, 'auth.credentials.provider_username') || 'Anonymous',
        };

        const ip = get_prop_val(event, 'info.remoteAddress');
        if( ip ) {
            data.ip = ip;
        }

        listener.logger.info(msg, data);
    });
}

function create_loggers() {
    LISTENERS.forEach(listener => {
        listener.logger =
            new (winston.Logger)({
                transports: [
                    new (winston.transports.File)({ filename: listener.file})
                ]
            })
    });
}

function get_prop_val(obj, key_chain, return_type) {
    const keys = key_chain.split('.');
    keys.forEach((key, i) =>
        obj = obj[key] || ( i===keys.length-1 ? null : {} ) );
    if( return_type && (obj===null || obj.constructor !== return_type ) ) {
        return new return_type();
    }
    return obj;
}

