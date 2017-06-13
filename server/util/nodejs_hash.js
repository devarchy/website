const assert = require('assert');
const crypto = require('crypto');

module.exports = function nodejs_hash(obj) {
    assert([String, Object, Array].includes(obj.constructor));
    const str = (
        obj.constructor===String ?
            obj :
            // not deterministic by spec, but deterministic in v8?
            JSON.stringify(obj)
    );
    return (
        crypto
        .createHash('md5')
        .update(str, 'utf8')
        .digest('base64')
        .replace(/=+$/, '')
    );
}
