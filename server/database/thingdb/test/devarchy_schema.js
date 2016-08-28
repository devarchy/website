"use strict";
require('./setup');
require('mocha');
const assert = require('assert');
const promise = require('./test-promise')();
const population = require('./population');
const Thing = require('../index.js')

describe("Devarchy's Schema", () => {

    before(population.create);

    promise.it("supports adding and parsing a markdown_list", () => {

        let http_max_delay__org = Thing.http_max_delay;
        Thing.http_max_delay = 10*1000;

        return (
            new Thing({
                type: 'tag',
                draft: {
                    author: population.user.id,
                    markdown_list__github_full_name: 'brillout/awesome-redux',
                    name: 'redux',
                },
            }).draft.save()
        )
        .then(([tag]) => {
            assert(tag);
            assert(tag.markdown_list__data);
            assert(tag.markdown_list__data.subheaders.length > 3);
            assert(tag.markdown_list__data.resources_all.length > 50);
            assert(tag.markdown_list__data.text === 'Awesome Redux', '`'+tag.markdown_list__data.text+'`');
            Thing.http_max_delay = http_max_delay__org;
            return [tag];
        })

    }, { timeout: 10*60*1000 });

});

