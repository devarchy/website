import assert from 'assert';

export default {
    points,
    date,
    age,
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

function age(d, {verbose}={}) {
    assert(d===null || d);

    if( d===null ) {
        return '?';
    }

    d = new Date(d);
    assert(d && !isNaN(d));

    const minutes = (new Date() - d) / (1000*60) | 0;
    if( minutes < 60 )
        return conjugate(minutes, 'minute');

    const hours = minutes / 60 | 0;
    if( hours < 24 )
        return conjugate(hours, 'hour');

    const days = hours / 24 | 0;
    if( days < 31 )
        return conjugate(days, 'day');

    const months = days / 30.5 | 0
    if( months < 12 )
        return conjugate(months, 'month');

    const years = months / 12 | 0;
    return conjugate(years, 'year');

    function conjugate(amount, unit) {
        const UNITES = verbose ? {
            'minute': 'minute',
            'hour': 'hour',
            'day': 'day',
            'month': 'month',
            'year': 'year',
        } : {
            'minute': 'mn',
            'hour': 'h',
            'day': 'd',
            'month': 'm',
            'year': 'y',
        };

        return !verbose ? amount+UNITES[unit] : amount+' '+UNITES[unit]+(amount===1?'':'s');
    }
}
