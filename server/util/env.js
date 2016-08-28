const env = {};

try {
    // `/.env/` is in `.gitignore`, therefore the env variables can be dropped there
    require('../../.env');
}catch(err){
    if( err.code !== 'MODULE_NOT_FOUND' ) throw err;
}

[
    'POSTGRES_PASSWORD',
    'HAPI_COOKIE_PASSWORD',
    'HAPI_AUTH_PASSWORD',
    'GITHUB_CLIENT_ID',
    'GITHUB_CLIENT_SECRET',
]
.forEach(env_var => {
    const val = process.env[env_var];
    if( ! val ) throw new Error("Environment variable `"+env_var+"` missing");
    env[env_var] = val;
})

module.exports = env;
