const web_catalog = require('./web_catalog');
const npm_catalog = require('./npm_catalog');

module.exports = function(linear_info) {
    linear_info.forEach(info => {
        info.processed = {};
        [web_catalog, npm_catalog].forEach(processor => {
            const res = processor.process(info.type, info.raw_data);
            if( res !== null ) {
                info.processed[processor.desc] = res;
            }
        });
    });
    return linear_info
};
