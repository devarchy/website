const assert = require('assertion-soft');
const assert_soft = require('assertion-soft');

module.exports = {
    points,
    date,
    age,
};

function points(n, {can_return_null, can_be_null}={}) {
    assert_soft(n || n===0 || n===null && can_be_null, n);

    if( ! n && n !== 0 ) {
        return can_return_null ? null : '?';
    }

    assert(Number.isInteger(n) && n >= 0);

    if( n < 1000 )
        return n.toString();

    return Math.floor(n / 1000) + 'k';
}

function date(d, {verbose=false, can_return_null, can_be_null, add_preposition=false}={}) {
    assert_soft(d || d===null && can_be_null, d);

    let ret = (() => {
        if( ! d ) {
            return can_return_null ? null : '?';
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
            return year.toString();
        }

        return month + '-' + year;
    })();

    if( add_preposition && ret ) {
        ret = ' '+(ret.length===4?'in':'on')+' '+ret;
    }

    return ret;
}

function age(d, {verbose, can_return_null, can_be_null, month_approximate}={}) {
    assert_soft(d || d===null && can_be_null, d);

    if( ! d ) {
        return can_return_null ? null : '?';
    }

    d = new Date(d);
    if( ! assert_soft(d && !isNaN(d)) ) return;

    const minutes = (new Date() - d) / (1000*60) | 0;
    const hours = minutes / 60 | 0;
    const days = hours / 24 | 0;
    const months = days / 30.5 | 0
    const years = months / 12 | 0;

    if( month_approximate ) {
        if( months < 1 ) {
            return '< '+ conjugate(1, 'month');
        }
    }

    if( minutes < 60 )
        return conjugate(minutes, 'minute');

    if( hours < 24 )
        return conjugate(hours, 'hour');

    if( days < 31 )
        return conjugate(days, 'day');

    if( months < 12 )
        return conjugate(months, 'month');

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
