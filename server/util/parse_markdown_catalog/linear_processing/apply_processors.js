const assert = require('assert');
const processors = require('./processors');

module.exports = function(linear_info, processor_options={}) {
    linear_info.forEach(info => {
        info.processed = {};
        processors
        .forEach(processor => {
            const info_title = processor.info_title;
            assert(info_title);
            const res = processor.process(info.type, info.raw_data, processor_options[info_title]);
            if( res !== null ) {
                info.processed[info_title] = res;
            }
        });
    });
};
