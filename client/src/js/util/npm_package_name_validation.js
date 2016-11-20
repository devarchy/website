const is_npm_package_name_valid__text = '`https://npmjs.com/package/npm-package-name` is expected with `npm-package-name` being composed of `a-z`, `A-Z`, `0-9`, `-`, `.`, `_` and with the first and last character being `a-z`, `A-Z`, or `0-9` (a scoped package should start with `@` and contain a `/`)';

module.exports = {
    is_npm_package_name_valid,
    is_npm_package_name_valid__text,
};

function is_npm_package_name_valid(npm_package_name) {
    const split = npm_package_name.split('/');

    if( split.length > 2 ) {
        return false;
    }

    if( split.length===2 ) {
        let scope = split[0];
        if( ! scope.startsWith('@') ) {
            return false;
        }
        scope = scope.slice(1);
        if( ! /^[a-zA-Z0-9]+$/.test(scope) ) {
            return false;
        }
    }

    const name = split.length===2 ? split[1] : split[0];
    if( ! /^[a-zA-Z0-9\-\.\_]+$/.test(name) || ! /^[a-zA-Z0-9]/.test(name) || ! /[a-zA-Z0-9]$/.test(name) ) {
        return false;
    }

    return true;
}
