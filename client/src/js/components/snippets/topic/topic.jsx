import React from 'react';
import assert_soft from 'assertion-soft';

import text_search from '../../../util/text_search';
import Tag from '../../../thing/tag';

import LinkMixin from '../../mixins/link';
import NeedsAndLibsPage from '../../pages/needs-and-libs';

const TopicSnippet = ({catalog_name, topic_name, full_text_search_value, topic_search_value}) => {
    if( ! assert_soft(catalog_name) ) return null;
    if( ! assert_soft(topic_name) ) return null;

    const children = (() => {
        if( topic_search_value && topic_search_value===topic_name ) {
            return text_search.hightlight_text(topic_name);
        }
        if( full_text_search_value ) {
            return text_search.highlight_search_match(topic_name, full_text_search_value);
        }
        return (
            topic_name
        );
    })();

    return (
        <LinkMixin
          to={Tag.topic__permalink({catalog_name, topic_name})}
          className="css_da sel_topic"
          {...{children}}
          track_info={{
              category: 'click_on_topic',
              action: catalog_name+'+'+topic_name,
          }}
        />
    );
};

export default TopicSnippet;
