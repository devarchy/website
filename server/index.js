if( process.env.SERVER_DOWN ) {
    // show server down notice
    require('./server_down');
} else {
    // setup database connection
    require('./database');

    // start http server
    require('./http');

    // throw an exception if an environment variable is missing
    require('./util/env.js');
}
