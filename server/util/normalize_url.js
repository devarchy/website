"use strict";


module.exports = normalize_url;
normalize_url.is_url = is_url;
normalize_url.remove_http_protocol = remove_http_protocol;
normalize_url.ensure_protocol_existence = ensure_protocol_existence;


const URL_PROTOCOL_REGEX = /https?\:\/\//;

function is_url(str) {
    return includes_protocol(str);
}

function includes_protocol(str) {
    return URL_PROTOCOL_REGEX.test(str);
}

function normalize_url(str) {
    if( !str ) {
        return str;
    }

    str = remove_http_protocol(str);
    str = remove_trailing_slash(str);
    str = remove_leading_www(str);

    return str;
}

function remove_trailing_slash(str) {
    return str.replace(/\/$/,'');
}

function remove_leading_www(str) {
    return str.replace(/^www\./,'');
}

function remove_http_protocol(str) {
    if( ! includes_protocol(str) ) {
        return str;
    }
    return str.replace(URL_PROTOCOL_REGEX,'');
}

function ensure_protocol_existence(str) {
    if( str && ! includes_protocol(str) ) {
        return 'http://'+str;
    }
    return str;
}
