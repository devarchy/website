const is_npm_package_name_valid__text = '`https://npmjs.com/package/npm-package-name` is expected with `npm-package-name` being composed of `a-z`, `A-Z`, `0-9`, `-`, `.`, `_` and with the first and last character being `a-z`, `A-Z`, or `0-9` (a scoped package should start with `@` and contain a `/`)';

const EXCEPTION_WHITELIST = [
    'ng2-clockTST',
    'NG2TableView',
];

module.exports = {
    is_npm_package_name_valid,
    is_npm_package_name_valid__text,
};

function is_npm_package_name_valid(npm_package_name) {

    if( EXCEPTION_WHITELIST.includes(npm_package_name) ) {
        return true;
    }

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
        if( ! is_valid(scope) ) {
            return false;
        }
    }

    const name = split.length===2 ? split[1] : split[0];

    if( ! is_valid(name) ) {
        return false;
    }

    return true;

}

function is_valid(str) {
    return (
        /^[a-z0-9\-\.\_]+$/.test(str) &&
        /^[a-z0-9]/.test(str) &&
        /[a-z0-9]$/.test(str)
    );
}
