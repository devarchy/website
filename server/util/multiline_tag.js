const assert = require('assert');

module.exports = ml;

/*
console.log(ml`
  test
  bla {
    uheiruhew
        eurh {
            var: ${1+1}
        }
  }
`, 'end'
);
//*/

function ml (strings, ...var_vals) {

    const str = (() => {
        let str = '';
        strings
        .forEach((s, i) => {
            str += s + (i===strings.length-1 ? '' : var_vals[i]);
        });
        return str;
    })();

    const lines = (() => {
        let lines = str.split('\n');
        assert(is_only_space(lines[0]));
        if( is_only_space(lines.slice(-1)[0]) ) {
            lines = lines.slice(0, -1);
        }
        lines = lines.slice(1);
        return lines;
    })();

    const code_indent = (() => {
        let number_of_spaces = Infinity;
        lines
        .filter(line => !is_only_space(line))
        .forEach(line => {
            const m = line.match(/^\s*/);
            assert(m.length===1);
            const line_indent = m[0];
            assert(line_indent.constructor===String);
            number_of_spaces = Math.min(number_of_spaces, line_indent.length);
        });
        if( number_of_spaces === Infinity ) {
            return '';
        }
        return (
            Array.apply(null, {length: number_of_spaces}).join(' ')+' '
        );
    })();

    return (
        lines
        .map(line => line.startsWith(code_indent)?line.slice(code_indent.length):line)
        .join('\n')
    );

    function is_only_space(str) {
        return /^\s*$/.test(str);
    }

}
