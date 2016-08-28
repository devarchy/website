export function is_npm_package_name_valid(npm_package_name) {
    // duplicate of devarchy/server/util/npm-api.js
    return (
        /^[a-zA-Z0-9\-\.\_]+$/.test(npm_package_name) &&
        /^[a-zA-Z0-9]/.test(npm_package_name) &&
        /[a-zA-Z0-9]$/.test(npm_package_name)
    );
}

export const is_npm_package_name_valid__text = '`https://npmjs.com/package/npm-package-name` is expected with `npm-package-name` composed of `a-z`, `A-Z`, `0-9`, `-`, `.`, `_` but not starting/ending with `-` or `.`';
