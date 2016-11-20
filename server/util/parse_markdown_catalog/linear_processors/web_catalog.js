const assert = require('assert');
const validator = require('validator');
const tlds = require('tlds');
const normalize_url = require('../../normalize_url');


module.exports = {
    process,
    desc: 'as_web_catalog',
};


function process(type, raw_data) {
    if( type === 'link' ) {
        return process_link(raw_data);
    }
    if( type === 'header') {
        return process_header(raw_data);
    }
    if( type === 'description') {
        return process_description(raw_data);
    }
}


function process_link(raw_data) { 
    const DESCRIPTION_PREFIX = ' - ';
    validate(!!raw_data.url, "URL shouldn't be empty");
    validate(!!raw_data.texts.inside, "URL text shouldn't be empty");
    if( ! normalize_url.is_url(raw_data.url) || !raw_data.texts.after.startsWith(DESCRIPTION_PREFIX) ) {
        return null;
    }
    validate(raw_data.texts.before==='', "URL shouldn't be preceded by any text");
    validate(validator.isURL(raw_data.url,{allow_underscores: true}), "Doesn't seem to be an URL: `"+raw_data.url+"`");
    const resource_url = raw_data.url;
    const dn = normalize_url(resource_url).split('/')[0];
    validate(validator.isFQDN(dn), "Doesn't seem to be a valid domain: `"+dn+"`");
    validate(tlds.includes(dn.split('.').slice(-1)[0]), "Doesn't seem to be a valid TLD for: `"+dn+"`");
    const title = raw_data.texts.inside;
    const description = raw_data.texts.after.slice(DESCRIPTION_PREFIX.length);
    delete raw_data;

    return {
        resource_url,
        title,
        description,
    };

    function validate(passed, msg){
        const last_line = raw_data.last_line;
        assert((last_line||{}).constructor===Number, JSON.stringify(raw_data, null, 2));
        if( !passed ) {
            const out =
                'Error at line '+last_line+': '+msg +'\n'+
                JSON.stringify(raw_data,null,2);
            throw new Error(out);
        }
    }
} 

function process_header(raw_data) { 
    const text = raw_data.text.trim();
    return {text};
} 

function process_description(raw_data) { 
    return {text: raw_data.text};
} 
