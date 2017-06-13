const Promise = require('bluebird'); Promise.longStackTraces();

if( process.env.SERVER_DOWN ) {
    // show server down notice
    require('./server_down');
} else {
    const bootup_request_date = new Date();

    // install sentry
    require('./util/error_tracker').install();

    // throw an exception if an environment variable is missing
    require('./util/env.js');

    const shutdown_args = {bootup_request_date};
    end_of_life(shutdown_args);

    // setup database connection
    shutdown_args.Thing = require('./database');

    // start http server
    const http_server_bootup = require('./http');
    http_server_bootup.then(server => shutdown_args.server = server);
    start_of_life({http_server_bootup, bootup_request_date});
}

function start_of_life({http_server_bootup, bootup_request_date}) { 
    http_server_bootup
    .then(server => {
        console.log([
            'Server bootup done',
            'uri: '+ server.info.uri,
            'Bootup duration: '+(new Date()-bootup_request_date)+'ms',
        ].join(', '));

        // let pm2 now that the process is ready
        process.send('ready');
    });
} 
function end_of_life(shutdown_args) { 
    const {bootup_request_date} = shutdown_args;

    ['SIGINT', 'SIGTERM']
    .forEach(SIG => process.on(SIG, err => stop(SIG, err)));

    function stop(SIG, err) {
        const {server, Thing} = shutdown_args;

        const signal_date = new Date();

        const age = (signal_date - bootup_request_date)/(60*1000);
        console.log('Server shutdown -- signal `'+SIG+'` received, pid: '+process.pid+', lived for: '+age+'m');
        if( err ) {
            console.log('Signal error: '+err);
        }

        return (
            Promise.resolve()
            .then(() => {
                if( ! server ) {
                    console.log('Server shutdown -- Error: `server` missing');
                    return;
                }
                return (
                    server.stop({timeout: 10 * 1000})
                    .then(err => {
                        if( err ) {
                            console.log('Server shutdown -- http stop error: '+err);
                        }
                        console.log('Server shutdown -- http stop done, pid: '+process.pid+', after: '+(new Date() - signal_date)+'ms');
                    })
                )
            })
            .then(() => {
                if( ! Thing ) {
                    console.log('Server shutdown -- Error: `Thing` missing');
                    return;
                }
                return (
                    Thing.database.close_connections()
                    .then(() => {
                        console.log('Server shutdown -- pg connection closing done, after: '+(new Date() - signal_date)+'ms');
                    })
                );
            })
            .then(() => {
                console.log('Server shutdown -- done, pid: '+process.pid+', took: '+(new Date() - signal_date)+'ms');
                process.exit(err?1:0);
            })
        );
    }
} 
