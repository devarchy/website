import assert from 'assert';

export default {
    points,
    date,
};

function points(n) {
    if( ! n && n !== 0 ) {
        return '?';
    }

    assert(Number.isInteger(n) && n >= 0);

    if( n < 1000 )
        return n.toString();

    return Math.floor(n / 1000) + 'k';
}

function date(d, {verbose=false}={}) {
    if( ! d ) {
        return '?';
    }

    d = new Date(d);
    assert(d && !isNaN(d));

    if( verbose ) {
        return new Date(d).toLocaleDateString();
    }

    let month = d.getMonth()+1;
    if( month < 10 ) month = '0'+month;

    const year = d.getFullYear();

    const MILISECONDS_IN_A_MONTH = 1000*60*60*24*30.5;
    const LIMIT = 12*1.5*MILISECONDS_IN_A_MONTH
    if( new Date() - d > LIMIT ) {
        return year;
    }

    return month + '-' + year;
}
