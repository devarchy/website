// `/.env/` is in `.gitignore`, therefore the env variables can be dropped there
const env = require('../../.env');
/*
let env = {};
try {
    env = require('../../.env');
}catch(err){
    if( err.code !== 'MODULE_NOT_FOUND' ) throw err;
}
*/

Object.keys(env)
.forEach(key => {
    env[key] = process.env[key] || env[key];
});

[
    'POSTGRES_PASSWORD',
    'HAPI_COOKIE_PASSWORD',
    'HAPI_AUTH_PASSWORD',
    'GITHUB_CLIENT_ID',
    'GITHUB_CLIENT_SECRET',
]
.forEach(key => {
    if( ! env[key] ) throw new Error("Environment variable `"+key+"` missing");
});

module.exports = env;
