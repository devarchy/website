const env = require('../util/env');

// corresponds to; `psql postgresql://user:password@host:port/database`
module.exports = {
    host     : 'localhost',
    port     : '5432',
    user     : 'postgres',
    password : env.POSTGRES_PASSWORD,
    database : 'devarchy',
    charset  : 'UTF8_GENERAL_CI'
};
