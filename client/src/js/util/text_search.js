import React from 'react';
import assert_soft from 'assertion-soft';

export default {get_missing_words, highlight_search_match, hightlight_text};

/*
function is_match({search_query, texts, return_match_count}) {
    assert_soft(false);

    const texts__match_count = Array(texts.length).fill(0);

    let it_is = true;

    search_query
    .split(' ')
    .filter(Boolean)
    .forEach(word => {
        word = word.toLowerCase();
        let it_is__word = false;
        texts.forEach((text, i) => {
            if( ! text ) {
                return;
            }
            if( ! assert_soft(text.constructor===String) ) return;
            if( text.toLowerCase().includes(word) ) {
                texts__match_count[i] = texts__match_count[i] + 1;
                it_is__word = true;
            }
        });
        it_is = it_is && it_is__word;
    });

    if( return_match_count ) {
        if( !it_is ) {
            return Array(texts.length).fill(0);
        }
        return texts__match_count;
    }

    return it_is;

}
*/

function get_missing_words({full_text_search_value, texts, per_text}) {
    assert_soft([true, false].includes(per_text));

    const words = (
        full_text_search_value
        .split(' ')
        .filter(Boolean)
        .map(word => word = word.toLowerCase())
    );

    const missing_words__per_text = (
        texts
        .map(text =>
            words
            .filter(word => {
                if( ['', null, undefined].includes(text) ) return true;
                if( ! assert_soft((text||0).constructor===String, text) ) return true;
                if( text.toLowerCase().includes(word) ) {
                    return false;
                }
                return true;
            })
        )
    );
    if( per_text ) {
        return missing_words__per_text;
    }
    return (
        missing_words__per_text[0]
        .filter(missing_word =>
            missing_words__per_text
            .slice(1)
            .every(missing_words => missing_words.includes(missing_word))
        )
    );
}

function highlight_search_match(str, full_text_search_value) {
    assert_soft(!full_text_search_value || full_text_search_value.constructor===String, full_text_search_value);
    if( ! assert_soft(str && str.constructor===String, str) ) return str;

    if( ! full_text_search_value ) return str;

    let match_intervals = [];

    const str_lower = str.toLowerCase();

    let limit=100;

    full_text_search_value
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .forEach(word => {
        var idx = str_lower.indexOf(word);
        while( idx!==-1 ) {
            if( !assert_soft(--limit > 0, word, str) ) return;
            match_intervals.push([idx, idx+word.length]);
            idx = str_lower.indexOf(word, idx+1);
        }
    })

    if( match_intervals.length === 0 ) {
        return str;
    }

    {
        assert_soft(match_intervals.every((interval, i) => {
            const start = interval[0];
            const end = interval[1];
            return (
                (
                    start.constructor===Number && end.constructor===Number
                ) && (
                    0 <= start && start < end && end && end <= str.length
                )
            );
        }), match_intervals, str.length, str, 'wrong match interval -- devarchy code');

        match_intervals = merge_overlapping_intervals(match_intervals);

        assert_soft(match_intervals.every((interval, i) => {
            const interval_next = match_intervals[i+1];
            const start = interval[0];
            const end = interval[1];
            return (
                (
                    start.constructor===Number && end.constructor===Number
                ) && (
                    0 <= start && start < end && end && end <= str.length
                ) && (
                    !interval_next || end <= interval_next[0]
                )
            );
        }), match_intervals, str.length, str, 'wrong match interval -- library code');
    }


    if( !assert_soft(match_intervals.length>0) ) return;

    let children = [
        str.slice(0, match_intervals[0][0]),
    ];

    match_intervals.forEach(([begin, end], i) => {
        children = [
            ...children,
            hightlight_text(str.slice(begin, end)),
            str.slice(end, (match_intervals[i+1]||[])[0]),
        ];
    });

    return <span children={children} />;
}

function hightlight_text(str) {
    return (
        React.createElement('b', {className: 'sel_highlight', children: str})
    );
}

/*
// - source; http://stackoverflow.com/questions/26390938/merge-arrays-with-overlapping-values
// - is bugy for search query `infinite pagination list down scrolling`
function merge_overlapping_intervals(ranges) {
    var result = [], r;

    ranges.sort(lowToHigh);

    var len = ranges.length;
    var i = 0;
    for(;i<len;i++){
        r = ranges[i];
        if(!result.length || r[0] > result[result.length-1][1])
            result.push(r);
        else
            result[result.length-1][1] = r[1];
    };

    return result;
}
function lowToHigh(a, b) {
    return a[0] > b[0];
}
/*/
// - source; https://github.com/jwarby/merge-ranges
function merge_overlapping_intervals(ranges) {
  if (!(ranges && ranges.length)) {
    return [];
  }

  // Stack of final ranges
  var stack = [];

  // Sort according to start value
  ranges.sort(function(a, b) {
    return a[0] - b[0];
  });

  // Add first range to stack
  stack.push(ranges[0]);

  ranges.slice(1).forEach(function(range, i) {
    var top = stack[stack.length - 1];

    if (top[1] < range[0]) {

      // No overlap, push range onto stack
      stack.push(range);
    } else if (top[1] < range[1]) {

      // Update previous range
      top[1] = range[1];
    }
  });

  return stack;
};
//*/
