import React from 'react';
import assert from 'assertion-soft';
import assert_soft from 'assertion-soft';

import user_tracker from '../../user_tracker';

import CollapseMixin from '../mixins/collapse';
import ResourceListSnippet from '../snippets/resource-list';


class ResourcesGraveyardCribSnippet extends React.Component {
    constructor(props) { super(props); this.state = {expanded: false}; }
    render() {
        const count_crib = this.props.crib.resource_list.length;
        const count_yard = this.props.yard.resource_list.length;
        if( count_crib===0 && count_yard===0 ) {
            return null;
        }
        return (
            <div>
                <h6
                  className="css_da css_hidden_note"
                  onClick={() => {
                      const expanded = this.state.expanded;
                      this.setState({expanded: !expanded});
                      {
                          const category = (expanded?'collapse':'extend')+' hidden_entries';
                          const action = this.props.tag_category && this.props.tag_category.category__path();
                          assert_soft(action, this.props.tag_category);
                          user_tracker.log_event({
                              category,
                              action,
                          });
                      }
                  }}
                >
                    {
                        (count_crib+count_yard)+' hidden'
                    }
                    {' '}
                    <em>
                    {
                        [
                            '(',
                            [
                                count_yard!==0 && (count_yard+' in Graveyard'),
                                count_crib!==0 && (count_crib+' in Crib'),
                            ].filter(Boolean).join(' & '),
                            ')',
                        ].join('')
                    }
                    </em>
                </h6>
                <CollapseMixin.component isOpened={this.state.expanded}>
                    {/*
                    <div style={{paddingTop: 5}}/>
                    */}
                    { count_crib!==0 && <div>
                        <h6
                          className="css_da css_category_resource_list_header"
                          style={{paddingTop: 3}}
                        >
                            Crib
                            <em> — not good enough (yet) to be included</em>
                        </h6>
                        {/*
                        <div className="css_small_header_description">Not good enough (yet) to be included</div>
                        */}
                        <ResourceListSnippet.component
                          {...this.props.crib}
                        />
                    </div> }
                    { count_crib!==0 && count_yard!==0 && <div style={{paddingTop: 2}}/> }
                    { count_yard!==0 && <div>
                        <h6
                          className="css_da css_category_resource_list_header"
                          style={{paddingTop: 3}}
                        >
                            Graveyard
                            <em> — unmaintained stuff</em>
                        </h6>
                        {/*
                        <div className="css_small_header_description">Unmaintained stuff</div>
                        */}
                        <ResourceListSnippet.component
                          {...this.props.yard}
                        />
                    </div> }
                    <div style={{paddingBottom: 15}}/>
                </CollapseMixin.component>
            </div>
        );
    }
}

function get_props({tag, tag_category, resources_declined, is_need_view}) {
    assert_soft(tag, tag);
    assert_soft(tag_category, tag_category);

    assert_soft(resources_declined, resources_declined);

    const resources_crib = [];
    const resources_yard = [];

    const THRESHOLD_MONTHS = 4.5;
    const MS_IN_A_MONTH = 30.5*24*60*60*1000;

    resources_declined.forEach(resource => {
        const last_commit = new Date((resource.github_info||{}).pushed_at);
        assert_soft(last_commit, resource.github_full_name);
        const is_in_graveyard = (new Date() - last_commit) > THRESHOLD_MONTHS*MS_IN_A_MONTH;
        (is_in_graveyard ? resources_yard : resources_crib).push(resource);
    });

    const crib = (
        ResourceListSnippet.get_props({
            tag,
            resource_list: resources_crib,
            is_need_view,
        })
    );

    const yard = (
        ResourceListSnippet.get_props({
            tag,
            resource_list: resources_yard,
            is_need_view,
        })
    );

    return {
        tag_category,
        crib,
        yard,
    };
}

export default {
    component: ResourcesGraveyardCribSnippet,
    get_props,
}
